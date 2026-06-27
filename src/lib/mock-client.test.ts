import { describe, expect, it, vi } from "vitest";

describe("mock-client", () => {
  it("verifies MOCK_ADDRESS is a valid Stellar address format", async () => {
    // Dynamically import to ensure fresh or standard load
    const { createMockClient } = await import("./mock-client");
    const client = createMockClient();
    const addressRes = await client.wallet.connect();
    const address = addressRes.data?.address;

    expect(address).toBeDefined();
    expect(address).toMatch(/^G[A-Z2-7]{55}$/);
  });

  it("verifies switchNetwork returns an error for invalid networks", async () => {
    const { createMockClient } = await import("./mock-client");
    const client = createMockClient();

    const res = await client.network.switchNetwork(
      "invalid" as unknown as Parameters<typeof client.network.switchNetwork>[0],
    );
    expect(res.data).toBeNull();
    expect(res.error).toBe("Invalid network: invalid");
  });

  it("verifies two separate imports produce identical MOCK_HISTORY transaction hashes (determinism)", async () => {
    // First import and fetch history
    const mod1 = await import("./mock-client");
    const client1 = mod1.createMockClient();
    const res1 = await client1.transaction.getHistory("address", 1, 10);
    const hashes1 = res1.data?.map(tx => tx.hash);

    // Reset modules and re-import
    vi.resetModules();

    const mod2 = await import("./mock-client");
    const client2 = mod2.createMockClient();
    const res2 = await client2.transaction.getHistory("address", 1, 10);
    const hashes2 = res2.data?.map(tx => tx.hash);

    expect(hashes1).toEqual(hashes2);
  });

  it("verifies getHistory respects the limit parameter", async () => {
    const { createMockClient } = await import("./mock-client");
    const client = createMockClient();
    
    const limit = 3;
    const res = await client.transaction.getHistory("address", 1, limit);
    
    expect(res.data).toBeDefined();
    expect(res.data?.length).toBe(limit);
  });
});
