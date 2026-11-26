import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

interface FarmPosition {
  id: string;
  pool: string;
  depositedA: string;
  depositedB: string;
  usdValue: number;
  baseApy: number;
  bonusApy: number;
  claimableRewards: number; // in XLM or custom token
  pendingRewards: number;
  timeInFarmSeconds: number;
  initialUsdValue: number; // to calculate Impermanent Loss
}

export function YieldFarmingScreen() {
  const [positions, setPositions] = useState<FarmPosition[]>([
    {
      id: "1",
      pool: "XLM / USDC",
      depositedA: "5000 XLM",
      depositedB: "520 USDC",
      usdValue: 1040,
      baseApy: 12.5,
      bonusApy: 4.2,
      claimableRewards: 12.45,
      pendingRewards: 2.1,
      timeInFarmSeconds: 86400 * 12 + 3600 * 4, // 12 days 4 hours
      initialUsdValue: 1060, // e.g. price change caused some IL
    },
    {
      id: "2",
      pool: "yXLM / XLM",
      depositedA: "2000 yXLM",
      depositedB: "2000 XLM",
      usdValue: 420,
      baseApy: 8.1,
      bonusApy: 0.0,
      claimableRewards: 3.12,
      pendingRewards: 0.45,
      timeInFarmSeconds: 86400 * 4 + 3600 * 18, // 4 days 18 hours
      initialUsdValue: 420.5,
    },
  ]);

  // Modals state
  const [selectedFarm, setSelectedFarm] = useState<FarmPosition | null>(null);
  const [modalType, setModalType] = useState<"claim" | "remove" | "stake" | null>(
    null,
  );
  const [slippage, setSlippage] = useState(0.5); // remove liquidity slippage %
  const [stakeAmount, setStakeAmount] = useState("");
  const [stakeError, setStakeError] = useState<string | null>(null);

  // Real-time updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPositions((prev) =>
        prev.map((pos) => {
          // Increment rewards slightly
          const earned = 0.01 + Math.random() * 0.02;
          const pending = 0.005 + Math.random() * 0.01;
          return {
            ...pos,
            claimableRewards: Number(
              (pos.claimableRewards + earned).toFixed(4),
            ),
            pendingRewards: Number((pos.pendingRewards + pending).toFixed(4)),
            timeInFarmSeconds: pos.timeInFarmSeconds + 5,
          };
        }),
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (totalSecs: number) => {
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  const handleClaimClick = (pos: FarmPosition) => {
    setSelectedFarm(pos);
    setModalType("claim");
  };

  const handleRemoveClick = (pos: FarmPosition) => {
    setSelectedFarm(pos);
    setModalType("remove");
  };

  const handleStakeClick = (pos: FarmPosition) => {
    setSelectedFarm(pos);
    setStakeAmount("");
    setStakeError(null);
    setModalType("stake");
  };

  const closeStake = () => {
    setStakeAmount("");
    setStakeError(null);
    setModalType(null);
  };

  const confirmStake = () => {
    if (!selectedFarm) return;

    const amount = Number(stakeAmount);
    if (!stakeAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      setStakeError("Enter a deposit amount greater than zero.");
      return;
    }

    setPositions((prev) =>
      prev.map((p) =>
        p.id === selectedFarm.id
          ? {
              ...p,
              usdValue: Number((p.usdValue + amount).toFixed(2)),
              initialUsdValue: Number((p.initialUsdValue + amount).toFixed(2)),
            }
          : p,
      ),
    );
    setStakeAmount("");
    setStakeError(null);
    setModalType(null);
  };

  // Perform calculations
  const totalClaimable = positions.reduce(
    (acc, pos) => acc + pos.claimableRewards,
    0,
  );

  return (
    <div className="space-y-6" data-testid="farming-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-ink">
            Yield Farming Positions
          </h2>
          <p className="text-[13px] text-ink-3">
            Track deposited capital, APY, rewards, and projected returns across
            Stellar pools.
          </p>
        </div>
        <div className="text-right bg-brand-dim border border-[rgba(86,69,212,0.2)] px-4 py-2 rounded-lg">
          <p className="text-[11px] text-brand uppercase font-bold tracking-wider">
            Total Claimable Rewards
          </p>
          <p
            className="text-[18px] font-extrabold text-ink"
            data-testid="total-rewards"
          >
            {totalClaimable.toFixed(4)} XLM
          </p>
        </div>
      </div>

      {/* Positions list */}
      <div className="grid grid-cols-1 gap-6">
        {positions.map((pos) => {
          const totalApy = pos.baseApy + pos.bonusApy;
          const dailyProjected = (pos.usdValue * (totalApy / 100)) / 365;
          const weeklyProjected = dailyProjected * 7;

          // Impermanent Loss Estimate calculation
          // Simplified: difference between pool value vs holding values
          // e.g. holding value change
          const holdValue = pos.initialUsdValue;
          const ilAmount = holdValue - pos.usdValue;
          const ilPercentage = holdValue > 0 ? (ilAmount / holdValue) * 100 : 0;

          return (
            <Card
              key={pos.id}
              className="border-line bg-surface overflow-hidden"
              data-testid="farming-card"
            >
              <CardHeader className="flex flex-row items-center justify-between bg-surface-2/40">
                <div>
                  <CardTitle className="text-[16px] font-bold text-ink">
                    {pos.pool}
                  </CardTitle>
                  <CardDescription>
                    Time in Farm: {formatDuration(pos.timeInFarmSeconds)}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="teal">Base APY: {pos.baseApy}%</Badge>
                  {pos.bonusApy > 0 && (
                    <Badge variant="primary">+{pos.bonusApy}% Bonus</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="py-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Deposited Capital */}
                <div>
                  <p className="text-[11px] font-bold uppercase text-ink-3">
                    Deposited Balance
                  </p>
                  <div className="mt-1 space-y-0.5">
                    <p className="text-[13px] text-ink">{pos.depositedA}</p>
                    <p className="text-[13px] text-ink">{pos.depositedB}</p>
                  </div>
                  <p className="text-[11px] text-ink-4 mt-2">
                    Value: ${pos.usdValue}
                  </p>
                </div>

                {/* Rewards Accumulation */}
                <div>
                  <p className="text-[11px] font-bold uppercase text-ink-3">
                    Accrued Rewards
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-[18px] font-bold text-ink">
                      {pos.claimableRewards.toFixed(4)} XLM
                    </span>
                    <Badge variant="success">Claimable</Badge>
                  </div>
                  <p className="text-[11px] text-ink-4 mt-1">
                    Pending: {pos.pendingRewards.toFixed(4)} XLM
                  </p>
                </div>

                {/* Projections & IL */}
                <div>
                  <p className="text-[11px] font-bold uppercase text-ink-3">
                    Risk & Projections
                  </p>
                  <div className="mt-1.5 space-y-1">
                    <div className="flex justify-between text-[12px] text-ink-2">
                      <span>Daily Projection:</span>
                      <strong className="text-ink">
                        ${dailyProjected.toFixed(2)}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[12px] text-ink-2">
                      <span>Weekly Projection:</span>
                      <strong className="text-ink">
                        ${weeklyProjected.toFixed(2)}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[12px] text-ink-2">
                      <span>Impermanent Loss (Est):</span>
                      <span
                        className={
                          ilPercentage > 0.1
                            ? "text-orange font-semibold"
                            : "text-green"
                        }
                      >
                        -{ilPercentage.toFixed(2)}% (${ilAmount.toFixed(2)})
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-surface-2/20 flex justify-between items-center py-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRemoveClick(pos)}
                >
                  Remove Liquidity
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleStakeClick(pos)}
                  >
                    Stake More
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleClaimClick(pos)}
                  >
                    Claim Rewards
                  </Button>
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Claim Modal */}
      {modalType === "claim" && selectedFarm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          data-testid="claim-modal"
        >
          <Card className="max-w-[400px] w-full bg-surface">
            <CardHeader>
              <CardTitle>Claim Farming Rewards</CardTitle>
              <CardDescription>
                Verify fees and claim your rewards from {selectedFarm.pool}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3.5 rounded bg-surface-2 border border-line">
                <p className="text-[11px] text-ink-3">
                  Accumulated Reward Balance
                </p>
                <p className="text-[20px] font-bold text-ink mt-1">
                  {selectedFarm.claimableRewards.toFixed(4)} XLM
                </p>
              </div>
              <div className="flex justify-between text-[12px] text-ink-2">
                <span>Transaction Fee Estimate:</span>
                <span className="font-semibold text-ink">0.0002 XLM</span>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setModalType(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setPositions(
                    positions.map((p) =>
                      p.id === selectedFarm.id
                        ? { ...p, claimableRewards: 0 }
                        : p,
                    ),
                  );
                  setModalType(null);
                }}
              >
                Confirm Claim
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Stake Modal */}
      {modalType === "stake" && selectedFarm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          data-testid="stake-modal"
        >
          <Card className="max-w-[400px] w-full bg-surface">
            <CardHeader>
              <CardTitle>Stake Into Pool</CardTitle>
              <CardDescription>
                Add capital to {selectedFarm.pool}. Rewards start accruing right
                away.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="stake-amount"
                  className="text-[12px] font-medium text-ink-2"
                >
                  Deposit amount (USD)
                </label>
                <input
                  id="stake-amount"
                  data-testid="stake-input"
                  type="number"
                  min="0"
                  step="any"
                  value={stakeAmount}
                  onChange={(e) => {
                    setStakeAmount(e.target.value);
                    setStakeError(null);
                  }}
                  className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink"
                  aria-invalid={stakeError ? true : undefined}
                  aria-describedby={stakeError ? "stake-error" : undefined}
                />
                {stakeError && (
                  <p
                    id="stake-error"
                    role="alert"
                    data-testid="stake-error"
                    className="text-[11px] text-red"
                  >
                    {stakeError}
                  </p>
                )}
              </div>
              <div className="p-3 bg-surface-2 rounded border border-line text-[11px] text-ink-2">
                <p>
                  Current value: ${selectedFarm.usdValue.toFixed(2)}
                </p>
                <p className="text-ink-3">
                  New value: $
                  {(selectedFarm.usdValue + (Number(stakeAmount) || 0)).toFixed(
                    2,
                  )}
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="secondary" size="sm" onClick={closeStake}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={confirmStake}>
                Confirm Stake
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Remove Liquidity Modal */}
      {modalType === "remove" && selectedFarm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          data-testid="remove-modal"
        >
          <Card className="max-w-[400px] w-full bg-surface">
            <CardHeader>
              <CardTitle>Remove Liquidity</CardTitle>
              <CardDescription>
                Confirm withdrawal from the {selectedFarm.pool} pool.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-ink-2 flex justify-between">
                  <span>Slippage Tolerance</span>
                  <span className="font-semibold text-ink">{slippage}%</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  value={slippage}
                  onChange={(e) => setSlippage(Number(e.target.value))}
                  className="w-full accent-brand"
                />
              </div>
              <div className="p-3 bg-surface-2 rounded border border-line text-[11px] text-ink-2 space-y-1">
                <p>
                  <strong>Withdrawal Estimate:</strong>
                </p>
                <p>
                  Receiving: {selectedFarm.depositedA} +{" "}
                  {selectedFarm.depositedB}
                </p>
                <p className="text-ink-3">
                  Estimated value: ~${selectedFarm.usdValue}
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setModalType(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setPositions(
                    positions.filter((p) => p.id !== selectedFarm.id),
                  );
                  setModalType(null);
                }}
              >
                Confirm Withdrawal
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
