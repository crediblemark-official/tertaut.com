export interface DisbursementCalculation {
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  feeRatePercent: number;
}

export function calculateDisbursement(
  amount: number,
  feeRatePercent: number = 5
): DisbursementCalculation {
  const feeRate = feeRatePercent / 100;
  const platformFee = Math.round(amount * feeRate);
  const netAmount = amount - platformFee;
  return {
    grossAmount: amount,
    platformFee,
    netAmount,
    feeRatePercent,
  };
}
