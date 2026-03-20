export interface User {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  role: string;
  role_tier: number;
  workstream: string;
  municipality: string;
  locality: string;
  ward?: string;
  created_at?: string;
}

export interface Assessment {
  id?: string;
  offline_id?: string;
  agent_id: string;
  shop_name: string;
  owner_name?: string;
  contact?: string;
  gps_lat?: number;
  gps_lng?: number;
  address?: string;
  is_registered?: boolean;
  has_cipc?: boolean;
  tax_compliant?: boolean;
  has_bank_account?: boolean;
  employs_staff?: boolean;
  staff_count?: number;
  stock_value?: string;
  compliance_score?: number;
  compliance_tier?: number;
  status: 'draft' | 'pending_sync' | 'submitted' | 'synced' | 'failed';
  created_at?: string;
  synced_at?: string;
}

export interface OfflineRecord {
  id: string;
  type: 'assessment';
  data: Assessment;
  created_at: number;
  status: 'pending' | 'synced' | 'failed';
}

export interface WizardStep {
  id: number;
  question: string;
  type: 'text' | 'tel' | 'yesno' | 'gps' | 'select' | 'review';
  options?: string[];
  required?: boolean;
  showFollowUp?: boolean;
}

export interface ComplianceTierInfo {
  tier: number;
  label: string;
  color: string;
  description: string;
}
