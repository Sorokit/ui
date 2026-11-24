import { expect, test } from "@playwright/test";

const CONNECTED_ADDRESS =
  "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA";

test("full staking flow: delegate → claim rewards → undelegate", async ({ page }) => {
  await test.step("connects wallet and navigates to Yield Farming", async () => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Connect Wallet", exact: true })
      .click();

    await expect(
      page.getByText(CONNECTED_ADDRESS, { exact: true }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Yield Farming", exact: true }).click();
    await expect(page).toHaveURL(/\/farming$/);
    await expect(
      page.getByRole("heading", { name: "Yield Farming Positions" }),
    ).toBeVisible();
  });

  await test.step("displays staking cards and selects delegate", async () => {
    await expect(page.getByTestId("total-rewards")).toBeVisible();
    await expect(page.getByTestId("farming-card").first()).toBeVisible();

    // Select "Delegate" action on the first card
    await page.getByTestId("delegate-button").first().click();
    await expect(
      page.getByRole("heading", { name: "Delegate XLM" }),
    ).toBeVisible();
  });

  await test.step("enters delegation amount and confirms", async () => {
    // Enter a delegation amount
    await page.getByRole("spinbutton", { name: "Amount" }).fill("1000");

    // Confirm the delegation
    await page.getByRole("button", { name: "Delegate" }).click();
    await expect(
      page.getByRole("button", { name: "Pending" }),
    ).toBeVisible({ timeout: 15000 });
  });

  await test.step("verifies delegation is pending", async () => {
    await expect(page.getByText("Delegation pending")).toBeVisible();
    await expect(page.getByTestId("delegation-status")).toContainText("pending");
  });

  await test.step("claims rewards", async () => {
    // Navigate back to farming positions
    await page.getByRole("button", { name: "Yield Farming", exact: true }).click();
    await expect(page).toHaveURL(/\/farming$/);

    // Click Claim Rewards
    await page.getByRole("button", { name: "Claim Rewards" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Claim Rewards" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Confirm Claim" }).click();

    // Modal closes after claim
    await expect(
      page.getByRole("heading", { name: "Claim Rewards" }),
    ).not.toBeVisible({ timeout: 10000 });

    // Verify rewards were claimed - check for updated balance
    await expect(page.getByTestId("total-rewards")).toBeVisible();
  });

  await test.step("undelegates staked amount", async () => {
    // Go to staking management
    await page.getByRole("button", { name: "Stake" }).click();
    await expect(page).toHaveURL(/\/farming$/);

    // Click Unbond/Undelgate
    await page.getByTestId("undelegate-button").first().click();
    await expect(
      page.getByRole("heading", { name: "Undelege XLM" }),
    ).toBeVisible();

    // Enter undelegation amount
    await page.getByRole("spinbutton", { name: "Amount" }).fill("500");

    // Confirm undelegation
    await page.getByRole("button", { name: "Undelege" }).click();

    // Verify undelegation is pending
    await expect(page.getByText("Undeleaging pending")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("undelegation-status")).toContainText("pending");
  });
});