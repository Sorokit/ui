import { expect, test } from "@playwright/test";

const DESTINATION =
  "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const CONNECTED_ADDRESS =
  "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA";

test("navigates to transactions and executes payment flow", async ({
  page,
}) => {
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

  await test.step("fills payment form and submits transaction", async () => {
    await page.getByLabel("Destination Address").fill(DESTINATION);
    await page.getByLabel("Amount (XLM)").fill("25");
    await page.getByRole("button", { name: "Send XLM" }).click();

    const modal = page.getByRole("dialog", { name: /confirm transaction/i });
    await expect(modal).toBeVisible();
    await page.getByRole("button", { name: "Confirm & Sign" }).click();

    await expect(page.getByText("Transaction submitted")).toBeVisible();
    await expect(page.locator("[data-txhash]").last()).toBeVisible();
  });
});
