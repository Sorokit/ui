import { expect, test } from "@playwright/test";

const CONNECTED_ADDRESS =
  "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA";

test("navigates to budget manager and inspects asset swap and spending breakdown", async ({
  page,
}) => {
  await test.step("connects wallet and navigates to Budget Manager", async () => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Connect Wallet", exact: true })
      .click();

    await expect(
      page.getByText(CONNECTED_ADDRESS, { exact: true }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Budget Manager", exact: true }).click();
    await expect(page).toHaveURL(/\/budget$/);
    await expect(
      page.getByRole("heading", { name: "Budget & Spending Tracker" }),
    ).toBeVisible();
  });

  await test.step("verifies spending limits and asset breakdown", async () => {
    await expect(page.getByText("Monthly Budget Limit")).toBeVisible();
    await expect(page.getByText("Spending Breakdown")).toBeVisible();
    await expect(page.getByText("By Asset")).toBeVisible();
    await expect(page.getByText("By Transaction Type")).toBeVisible();
  });

  await test.step("updates budget configuration limits", async () => {
    const budgetInput = page.getByLabel("Set Budget Limit ($)");
    await budgetInput.fill("2000");

    const lockCheckbox = page.getByTestId("lock-checkbox");
    await lockCheckbox.check();
    await expect(lockCheckbox).toBeChecked();
  });
});
