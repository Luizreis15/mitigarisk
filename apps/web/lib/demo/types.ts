export type DemoRole = 'company' | 'company-admin' | 'super-admin' | 'operator';

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
export type HumanDecision =
  | 'approve'
  | 'reject'
  | 'escalate'
  | 'request_more_info';
export type TimelineAction =
  | 'evaluation.completed'
  | 'case.opened'
  | 'evidence.requested'
  | 'decision.recorded'
  | 'case.escalated';
export type CasePriority = 'low' | 'normal' | 'high' | 'urgent';
export type EvidenceState = 'none' | 'requested' | 'partial' | 'complete';
export type NextActionId =
  | 'claim'
  | 'review_evidence'
  | 'request_information'
  | 'record_decision'
  | 'await_analyst'
  | 'none';
export type WorkbenchView =
  | 'open'
  | 'needs_information'
  | 'escalated'
  | 'closed';

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
  correlationId: string;
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
  evaluationId: string | null;
  reference: string;
  subject: string;
  tenant: string;
  status: CaseStatus;
  slaDueAt: string;
  assignee: string;
  evidenceCount: number;
  lastNote: string;
  correlationId: string;
  priority: CasePriority;
  lastActivityAt: string;
  evidenceState: EvidenceState;
  nextAction: NextActionId;
  riskBand: RiskBand | null;
  recordedDecision: HumanDecision | null;
};

export type DemoTimelineEvent = {
  id: string;
  caseId: string;
  action: TimelineAction;
  actor: string;
  at: string;
  correlationId: string;
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
  | 'platform.admin'
  | 'policy.view'
  | 'tenant.view'
  | 'tenant.manage_settings'
  | 'tenant.manage_members';

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
  | 'denied-admin'
  | 'empty-members'
  | 'denied-members'
  | 'loading-admin'
  | 'error-admin'
  | 'empty-entities'
  | 'denied-evaluate'
  | 'loading-entities'
  | 'error-entities';

export type PrototypeScenario = {
  id: PrototypeScenarioId;
  href: string;
};

export type PolicyLifecycle = 'draft' | 'published' | 'archived';
export type PolicyFactorKey = 'identity' | 'fraud' | 'regulatory' | 'financial';
export type PolicyRecommendationPath =
  | 'accept_path'
  | 'review'
  | 'additional_evidence';
export type PolicyHistoryAction =
  | 'policy.created'
  | 'policy.published'
  | 'policy.archived';

export type DemoPolicyFactor = {
  key: PolicyFactorKey;
  weight: number;
};

export type DemoPolicyThreshold = {
  minScore: number;
  maxScore: number;
  scoreBand: RiskBand;
  recommendationPath: PolicyRecommendationPath;
};

export type DemoPolicyHistoryEvent = {
  id: string;
  policyId: string;
  action: PolicyHistoryAction;
  actor: string;
  at: string;
  correlationId: string;
};

export type DemoPolicy = {
  id: string;
  name: string;
  versionNumber: number;
  lifecycle: PolicyLifecycle;
  owner: string;
  tenant: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  lastActivityAt: string;
  supersededBy: string | null;
  factors: DemoPolicyFactor[];
  thresholds: DemoPolicyThreshold[];
};
