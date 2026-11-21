import { expect, test } from "@playwright/test";

const DESTINATION =
  "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const CONNECTED_ADDRESS =
  "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA";

test("multi-asset payment flow — sends XLM then USDC sequentially and verifies both in history", async ({
  page,
}) => {
  // Inject mock balances with XLM and USDC
  await page.addInitScript(() => {
    (globalThis as unknown as { __MOCK_BALANCES__: unknown[] }).__MOCK_BALANCES__ = [
      { asset: "XLM", balance: "10000.0000000", assetType: "native" },
      {
        asset: "USDC",
        balance: "5000.0000000",
        assetType: "credit_alphanum4",
        assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      },
    ];
  });

  await test.step("connects wallet from home screen", async () => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Connect Wallet", exact: true })
      .click();

    await expect(
      page.getByText(CONNECTED_ADDRESS, { exact: true }).first(),
    ).toBeVisible();
  });

  await test.step("navigates to Transactions screen", async () => {
    await page.getByRole("button", { name: "Transactions", exact: true }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(
      page.getByRole("heading", { name: "Transaction History" }),
    ).toBeVisible();
  });

  let xlmTxHash = "";
  await test.step("sends XLM payment", async () => {
    await page.getByLabel("Destination Address").fill(DESTINATION);
    await page.getByLabel("Amount (XLM)").fill("25");
    await page.getByRole("button", { name: "Send XLM" }).click();

    const modal = page.getByRole("dialog", { name: /confirm transaction/i });
    await expect(modal).toBeVisible();
    await page.getByRole("button", { name: "Confirm & Sign" }).click();

    await expect(page.getByText("Transaction submitted")).toBeVisible();
    xlmTxHash = (await page.locator("[data-txhash]").last().textContent())?.trim() ?? "";
    expect(xlmTxHash).toBeTruthy();
  });

  await test.step("resets form for next payment", async () => {
    await page.getByRole("button", { name: "New Transaction" }).click();
    await expect(page.getByLabel("Destination Address")).toBeVisible();
  });

  let usdcTxHash = "";
  await test.step("sends USDC payment in same session", async () => {
    // Select USDC asset
    await page.getByLabel("Asset").selectOption("USDC");

    await page.getByLabel("Destination Address").fill(DESTINATION);
    await page.getByLabel("Amount (USDC)").fill("10");
    await page.getByRole("button", { name: "Send USDC" }).click();

    const modal = page.getByRole("dialog", { name: /confirm transaction/i });
    await expect(modal).toBeVisible();
    await page.getByRole("button", { name: "Confirm & Sign" }).click();

    await expect(page.getByText("Transaction submitted")).toBeVisible();
    usdcTxHash = (await page.locator("[data-txhash]").last().textContent())?.trim() ?? "";
    expect(usdcTxHash).toBeTruthy();
    expect(usdcTxHash).not.toEqual(xlmTxHash);
  });

  await test.step("verifies both multi-asset transactions in transaction history", async () => {
    await expect(page.getByRole("heading", { name: "Transaction History" })).toBeVisible();
    await expect(page.getByText("25 XLM")).toBeVisible();
    await expect(page.getByText("10 USDC")).toBeVisible();
  });
});
