import { ComplianceTierInfo } from './types';

export interface ComplianceAnswers {
  is_registered?: boolean;
  has_cipc?: boolean;
  tax_compliant?: boolean;
  has_bank_account?: boolean;
  employs_staff?: boolean;
  staff_count?: number;
  stock_value?: string;
}

export function calculateScore(answers: ComplianceAnswers): number {
  let score = 0;

  if (answers.is_registered) score += 25;
  if (answers.has_cipc) score += 20;
  if (answers.tax_compliant) score += 20;
  if (answers.has_bank_account) score += 20;
  if (answers.employs_staff) score += 10;

  if (answers.stock_value === 'R20,001 - R50,000' || answers.stock_value === 'Over R50,000') {
    score += 5;
  }

  return Math.min(score, 100);
}

export function getComplianceTier(score: number): ComplianceTierInfo {
  if (score >= 80) {
    return {
      tier: 1,
      label: 'Tier 1 - NEF Eligible',
      color: 'bg-green-600',
      description: 'Highly compliant and eligible for enterprise funding',
    };
  } else if (score >= 60) {
    return {
      tier: 2,
      label: 'Tier 2 - Conditionally Eligible',
      color: 'bg-blue-600',
      description: 'Meets basic requirements with some conditions',
    };
  } else if (score >= 40) {
    return {
      tier: 3,
      label: 'Tier 3 - Needs Support',
      color: 'bg-yellow-600',
      description: 'Requires support and capacity building',
    };
  } else {
    return {
      tier: 4,
      label: 'Tier 4 - Critical',
      color: 'bg-red-600',
      description: 'Requires significant support and intervention',
    };
  }
}

export function getTierColor(tier: number): string {
  switch (tier) {
    case 1:
      return '#10b981';
    case 2:
      return '#3b82f6';
    case 3:
      return '#f59e0b';
    case 4:
      return '#ef4444';
    default:
      return '#6b7280';
  }
}
