export type DemoRole = 'empresa' | 'super-admin' | 'operador';

export type RiskBand = 'low' | 'medium' | 'high';
export type CaseStatus =
  | 'open'
  | 'in_review'
  | 'waiting_evidence'
  | 'escalated'
  | 'closed';
export type AlertSeverity = 'info' | 'warning' | 'danger';
export type TenantHealth = 'healthy' | 'degraded' | 'incident';
export type DataQuality = 'complete' | 'partial' | 'insufficient';

export type DemoEvaluation = {
  id: string;
  externalRef: string;
  subject: string;
  tenant: string;
  score: number;
  band: RiskBand;
  quality: DataQuality;
  policyVersion: string;
  reasons: string[];
  actor: string;
  evaluatedAt: string;
  recommendation: string;
};

export type DemoAlert = {
  id: string;
  title: string;
  severity: AlertSeverity;
  tenant: string;
  subject: string;
  openedAt: string;
  slaMinutes: number;
};

export type DemoCase = {
  id: string;
  subject: string;
  tenant: string;
  status: CaseStatus;
  slaDueAt: string;
  assignee: string;
  evidenceCount: number;
  lastNote: string;
};

export type DemoTenant = {
  id: string;
  name: string;
  plan: string;
  health: TenantHealth;
  evaluationsToday: number;
  webhookFailures: number;
  consumptionPct: number;
};
