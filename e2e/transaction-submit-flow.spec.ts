import { expect, test } from "@playwright/test";

const DESTINATION = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";
const CONNECTED_ADDRESS =
  "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA";
const AMOUNT = "25";
const MEMO = "Invoice #1100";

function truncateHash(hash: string, start = 10, end = 6): string {
  if (hash.length <= start + end) return hash;
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
}

test("completes full transaction submit flow from wallet selection to toast and history", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  // Suppress the first-visit onboarding modal so navigation stays deterministic.
  await page.addInitScript(() => {
    (
      globalThis as unknown as {
        localStorage?: { setItem: (key: string, value: string) => void };
      }
    ).localStorage?.setItem("sorokit_onboarding_seen", "true");
  });

  await test.step("selects a wallet on ConnectScreen and connects", async () => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Connect Wallet" }),
    ).toBeVisible();

    const freighterButton = page.getByRole("button", {
      name: "Connect with Freighter",
      exact: true,
    });
    await expect(freighterButton).toBeVisible();
    await freighterButton.click();

    await expect(
      page
        .getByTestId("screen-wrapper-wallet")
        .getByText("Connected", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(CONNECTED_ADDRESS, { exact: true }).first(),
    ).toBeVisible();
  });

  await test.step("navigates to Transactions screen", async () => {
    await page
      .getByRole("button", { name: "Transactions", exact: true })
      .click();

    await expect(page).toHaveURL(/\/transactions$/);
    await expect(
      page.getByRole("heading", { name: "Send Payment" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Transaction History", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("25 transactions")).toBeVisible();
  });

  await test.step("fills payment form and opens confirmation modal", async () => {
    const sendButton = page.getByTestId("submit-transaction");
    await expect(sendButton).toBeDisabled();

    await page.getByLabel("Destination Address").fill(DESTINATION);
    await page.getByLabel("Amount (XLM)").fill(AMOUNT);
    await page.getByLabel("Memo (optional)").fill(MEMO);

    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    const modal = page.getByRole("dialog", { name: /confirm transaction/i });
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Send 25 XLM to/)).toBeVisible();
    await expect(modal.getByText(new RegExp(MEMO))).toBeVisible();
    await expect(modal.getByText("Base fee")).toBeVisible();
    await expect(modal.getByText("Source account")).toBeVisible();
  });

  let txHash = "";
  await test.step("confirms transaction and asserts success toast and panel result", async () => {
    const modal = page.getByRole("dialog", { name: /confirm transaction/i });
    await modal.getByRole("button", { name: "Confirm & Sign" }).click();

    await expect(modal).not.toBeVisible();

    const txScreen = page.getByTestId("screen-wrapper-transactions");
    await expect(txScreen.getByText("Transaction submitted")).toBeVisible();
    await expect(txScreen.getByText("Successful", { exact: true })).toBeVisible();

    const submittedHashEl = txScreen.locator("a[data-txhash] span, [data-testid='submitted-tx-hash']").first();
    await expect(submittedHashEl).toBeVisible();
    txHash = ((await submittedHashEl.textContent()) ?? "").trim();
    expect(txHash).toMatch(/^[0-9a-f]{64}$/i);

    const toastViewport = page.getByTestId("toast-viewport");
    await expect(toastViewport).toBeVisible();
    const successToast = toastViewport.getByRole("alert").filter({
      hasText: "Transaction sent",
    });
    await expect(successToast).toBeVisible();
    await expect(successToast).toContainText(`Hash: ${txHash}`);
  });

  await test.step("asserts submitted transaction appears in Transaction History", async () => {
    await expect(page.getByText("26 transactions")).toBeVisible();

    const latestRow = page.getByRole("article").first();
    await expect(latestRow).toBeVisible();
    await expect(latestRow).toContainText(truncateHash(txHash));
    await expect(latestRow).toContainText("Success");
    await expect(latestRow).toContainText("Ledger 12345");
    await expect(latestRow).toContainText(MEMO);
  });

  expect(pageErrors).toEqual([]);
});
