export interface PolicyClaim {
  payoutAmount: number;
  triggerType: string;
  status: string;
  createdAt: string;
}

export interface PolicySummary {
  id: string;
  status: string;
  coveragePerDay: number;
  weeklyPremium: number;
  weekStartDate: string;
  weekEndDate: string;
  claims?: PolicyClaim[];
}
