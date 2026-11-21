# Async Race Conditions & Stale Closures — Fix Report

This document describes three async correctness issues in the data-fetching layer
and how each is resolved. All three fixes are implemented and verified.

## Summary

| # | Location | Problem | Fix |
|---|----------|---------|-----|
| 1 | `src/components/TransactionHistory.tsx` | Stale in-flight fetch overwrites current results on rapid address or page changes | `fetchIdRef` counter invalidates superseded in-flight responses across effect cycles |
| 2 | `src/components/ContractEventFeed.tsx` | Polling interval captures a stale `load` closure | `load` wrapped in `useCallback`; added to effect deps |
| 3 | `src/context/SorokitProvider.tsx` | Account fetch resolves for a stale address | `active` cleanup flag guards all state setters |

---

## 1. TransactionHistory — stale fetch overwrites current page

**File:** `src/components/TransactionHistory.tsx`

The history effect fires on both `address` and `page` changes. When the user
rapidly changes page (or the wallet address updates mid-flight triggering a
page-reset cycle), multiple rapid effect executions occur. A previous in-flight
request could resolve *after* a newer one and overwrite the correct results
with stale data if an effect's local active flag is reused in subsequent cycles.

**Fix:** A shared `fetchIdRef` counter tracks each fetch cycle. Each fetch start
increments `fetchIdRef.current` to acquire a unique `fetchId`. Both the timer
callback and response handler verify `fetchId === fetchIdRef.current` before
updating state, and the cleanup increments `fetchIdRef.current` and clears the timer:

```ts
const fetchIdRef = useRef(0);

useEffect(() => {
  if (!address || !client) return;

  const fetchId = ++fetchIdRef.current;
  const timerId = window.setTimeout(() => {
    if (fetchId !== fetchIdRef.current) return;
    setLoading(true);
    client
      .transaction.getHistory(address, page, PAGE_SIZE)
      .then(({ data, error: err, total: t }) => {
        if (fetchId !== fetchIdRef.current) return; // stale guard
        if (err) { setError(err); return; }
        setTxs(data ?? []);
        setTotal(t);
        setError(null);
      })
      .finally(() => {
        if (fetchId === fetchIdRef.current) setLoading(false); // stale guard
      });
  }, 0);

  return () => {
    fetchIdRef.current++;
    window.clearTimeout(timerId);
  };
}, [address, client, page]);
```

**Result:** rapidly changing address or page never displays a previous fetch's results.

---

## 2. ContractEventFeed — polling interval captured a stale closure

**File:** `src/components/ContractEventFeed.tsx`

The polling effect set up `setInterval(load, pollInterval)`, but `load` was not
in the effect's dependency array. The interval kept calling the version of `load`
captured on first render — with the initial `contractId` and `limit` — so
changing those props live did not affect the polling fetch.

**Fix:** `load` is memoized with `useCallback([contractId, limit])` and is listed
in the dependency arrays of both effects that use it. When the props change,
`load` is recreated and the interval is torn down and re-established with the
fresh callback:

```ts
const load = useCallback(async () => {
  if (!contractId.trim()) return;
  // ...fetch with current contractId + limit...
}, [contractId, limit]);

useEffect(() => {
  if (live && pollInterval > 0) {
    intervalRef.current = setInterval(() => { void load(); }, pollInterval);
  } else if (intervalRef.current) {
    clearInterval(intervalRef.current);
  }
  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
}, [live, pollInterval, load]);
```

**Result:** the polling interval always calls `load` with the current
`contractId` and `limit` props.

---

## 3. SorokitProvider — account fetch resolved for a stale address

**File:** `src/context/SorokitProvider.tsx`

`Promise.all([getAccount, getBalances])` could resolve and call
`setAccount` / `setBalances` even after `address` had changed again — for
example when the user disconnects immediately after connecting — leaving stale
account data for the wrong address in context.

**Fix:** the address effect uses the same `active` cleanup flag pattern, guarding
every state setter so only the current request can write to context:

```ts
useEffect(() => {
  if (!address) return;

  let active = true;
  const timerId = window.setTimeout(() => {
    setIsLoadingAccount(true);
    Promise.all([
      client.account.getAccount(address),
      client.account.getBalances(address),
    ])
      .then(([accountRes, balancesRes]) => {
        if (!active) return;            // stale guard
        if (accountRes.data) setAccount(accountRes.data);
        if (accountRes.error) setError(accountRes.error);
        if (balancesRes.data) setBalances(balancesRes.data);
        if (balancesRes.error) setError(balancesRes.error);
      })
      .finally(() => {
        if (active) setIsLoadingAccount(false);
      });
  }, 0);

  return () => {
    active = false;
    window.clearTimeout(timerId);
  };
}, [address, client]);
```

**Result:** disconnecting a wallet immediately after connecting leaves `account`
and `balances` as `null` / `[]`, not populated with the disconnected address's
data.

---

## Acceptance criteria

- [x] Rapidly changing page in `TransactionHistory` never shows a previous page's request results.
- [x] `ContractEventFeed` polling always calls `load` with the current `contractId` and `limit`.
- [x] Disconnecting immediately after connecting in `SorokitProvider` leaves `account`/`balances` empty.
- [x] No new `react-hooks/exhaustive-deps` warnings — all effect dependency arrays are complete.
- [x] Behavior verified against the cleanup-flag and memoized-callback patterns above.
