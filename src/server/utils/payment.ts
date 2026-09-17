import { config } from "../config";

export function calculateMor(amount: number, feeRatePercent: number) {
  const feeRate = feeRatePercent / 100;
  const platformFee = Math.round(amount * feeRate);
  const netAmount = amount - platformFee;
  return { grossAmount: amount, platformFee, netAmount };
}
