import { expect, test } from "@playwright/test";

const CONNECTED_ADDRESS =
  "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA";

test("navigates to yield farming and interacts with staking positions", async ({
  page,
}) => {
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

  await test.step("displays staking cards and claimable rewards", async () => {
    await expect(page.getByTestId("total-rewards")).toBeVisible();
    await expect(page.getByTestId("farming-card").first()).toBeVisible();
  });

  await test.step("opens claim rewards modal and confirms", async () => {
    await page.getByRole("button", { name: "Claim Rewards" }).first().click();

    await expect(
      page.getByRole("heading", { name: "Claim Rewards" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Confirm Claim" }).click();

    // Modal closes after claim
    await expect(
      page.getByRole("heading", { name: "Claim Rewards" }),
    ).not.toBeVisible();
  });
});
