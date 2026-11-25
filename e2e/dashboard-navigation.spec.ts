import { expect, test } from "@playwright/test";

const NAVIGATION_CASES = [
  { id: "wallet", label: "Wallet", path: "/", content: "Receive Funds" },
  { id: "account", label: "Account", path: "/account", content: "Account" },
  {
    id: "transactions",
    label: "Transactions",
    path: "/transactions",
    content: "Transaction History",
  },
  { id: "soroban", label: "Soroban", path: "/soroban", content: "Soroban" },
  { id: "network", label: "Network", path: "/network", content: "Active Network" },
  {
    id: "recovery",
    label: "Recovery Assistant",
    path: "/recovery",
    content: "Account Recovery Assistant",
  },
  {
    id: "charts",
    label: "Advanced Charting",
    path: "/charts",
    content: "Advanced Charting",
  },
  {
    id: "portfolio",
    label: "Portfolio Analytics",
    path: "/portfolio",
    content: "Portfolio Analytics",
  },
  {
    id: "farming",
    label: "Yield Farming",
    path: "/farming",
    content: "Yield Farming Positions",
  },
  {
    id: "budget",
    label: "Budget Manager",
    path: "/budget",
    content: "Budget & Transaction Limits",
  },
  { id: "nfts", label: "NFTs", path: "/nfts", content: "NFT Gallery" },
  { id: "governance", label: "Governance", path: "/governance", content: "Governance" },
] as const;

test("navigates through every dashboard section", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect Wallet", exact: true })
    .click();

  await expect(
    page.getByText(
      "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA",
      { exact: true },
    ).first(),
  ).toBeVisible();

  for (const destination of NAVIGATION_CASES) {
    await test.step(`navigates to ${destination.label}`, async () => {
      await page
        .getByRole("button", { name: destination.label, exact: true })
        .click();

      await expect(page).toHaveURL(new RegExp(`${destination.path}$`));
      const activeScreen = page.getByTestId(
        `screen-wrapper-${destination.id}`,
      );
      await expect(activeScreen).toBeVisible();
      await expect(
        activeScreen.getByText(destination.content, { exact: true }).first(),
      ).toBeVisible();
    });
  }

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
