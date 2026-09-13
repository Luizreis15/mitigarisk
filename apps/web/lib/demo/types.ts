export type DemoRole = 'company' | 'super-admin' | 'operator';

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
  billedMinorUnits: number;
};

export type Capability =
  | 'company.view'
  | 'company.evaluate'
  | 'operator.queue'
  | 'platform.admin';

export type MembershipStatus = 'active' | 'invited' | 'onboarding';

export type MembershipViewModel = {
  id: string;
  tenantId: string;
  tenantName: string;
  environment: string;
  role: DemoRole;
  status: MembershipStatus;
  capabilities: Capability[];
  href: string;
};

export type OnboardingStepId =
  | 'company_profile'
  | 'environment'
  | 'policy_template'
  | 'invite_operators';

export type OnboardingStepViewModel = {
  id: OnboardingStepId;
  optional: boolean;
};

export type PrototypeScenarioId =
  | 'empty-company'
  | 'empty-operator'
  | 'empty-admin'
  | 'denied-admin';

export type PrototypeScenario = {
  id: PrototypeScenarioId;
  href: string;
};
