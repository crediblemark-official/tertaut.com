export interface MorCalculation {
  grossAmount: number;
  platformFee: number;
  netAmount: number;
}

export function calculateMor(amount: number, feeRatePercent: number): MorCalculation {
  const feeRate = feeRatePercent / 100;
  const platformFee = Math.round(amount * feeRate);
  const netAmount = amount - platformFee;
  return { grossAmount: amount, platformFee, netAmount };
}
