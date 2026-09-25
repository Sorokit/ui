import { expect, test } from "@playwright/test";

const DESTINATION =
  "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const CONNECTED_ADDRESS =
  "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA";

/**
 * The four behaviors below are one continuous user journey, so they share a
 * single page and run in order. They are wrapped in `test.step()` rather than
 * asserted as one flat block so the reporter attributes a failure to the
 * specific behavior that broke - previously a failure at "connect wallet"
 * said nothing about whether history and send-payment still worked.
 */
test("connects a wallet, views transaction history, and sends a payment", async ({
  page,
}) => {
  await test.step("app loads with ConnectScreen visible", async () => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Connect Wallet" }),
    ).toBeVisible();
  });

  await test.step("connecting a wallet transitions to the Dashboard", async () => {
    await page
      .getByRole("button", { name: "Connect Wallet", exact: true })
      .click();

    await expect(
      page
        .getByTestId("screen-wrapper-wallet")
        .getByText("Connected", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(CONNECTED_ADDRESS, { exact: true }).first(),
    ).toBeVisible();
  });

  await test.step("Transactions renders paginated history rows", async () => {
    await page.getByRole("button", { name: "Transactions", exact: true }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    await expect(
      page.getByRole("heading", { name: "Transaction History" }),
    ).toBeVisible();
    await expect(page.getByRole("article").first()).toBeVisible();
    await expect(page.getByText("Page 1 of 3")).toBeVisible();
  });

  await test.step("sending a payment shows the transaction hash", async () => {
    await page.getByLabel("Destination Address").fill(DESTINATION);
    await page.getByLabel("Amount (XLM)").fill("10");
    await page.getByRole("button", { name: "Send XLM" }).click();
    await page.getByRole("button", { name: "Confirm & Sign" }).click();

    await expect(page.getByText("Transaction submitted")).toBeVisible();
    await expect(page.locator("[data-txhash]").last()).toBeVisible();
  });
});
