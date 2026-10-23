export function resolveDisbursementAccount(
  builder:
    | {
        name?: string | null;
        disbursementAccount?: {
          bankCode?: string;
          accountNumber?: string;
          accountHolderName?: string;
          eWalletType?: string;
          phoneNumber?: string;
        } | null;
      }
    | null
    | undefined
): {
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
} | null {
  const acc = builder?.disbursementAccount;

  if (acc?.accountNumber && acc?.bankCode) {
    return {
      bankCode: acc.bankCode,
      accountNumber: acc.accountNumber,
      accountHolderName: acc.accountHolderName || builder?.name || "Builder",
    };
  }

  return null;
}
