export interface CollectionConfig {
  collectionIdentifier: string;
  displayName: string;
  floorPrice: string;       // UFix64 as string from Flow
  ltvRatio: string;         // e.g., "0.40"
  interestRate: string;     // annual simple interest rate, e.g., "0.15" = 15% APR
  maxLoanDuration: string;  // seconds as string
  isActive: boolean;
  tier: 1 | 2 | 3;
}

export interface LoanInfo {
  id: string;
  borrower: string;
  principal: string;
  interestRate: string;
  startTime: string;
  duration: string;
  collectionIdentifier: string;
  nftIDs: string[];
  repaidAmount: string;
  totalRepayment: string;
  status: "Active" | "Repaid" | "Liquidated";
  outstandingBalance: string;
  expiryTime: string;
  isExpired: boolean;
  isInGracePeriod: boolean;
  isEligibleForLiquidation: boolean;
}

export interface ProtocolStats {
  totalLoans: string;
  activeLoans: string;
  totalFlowDisbursed: string;
  totalInterestEarned: string;
  treasuryBalance: string;
  isPaused: boolean;
}
