import type {
  AlertSeverity,
  CaseStatus,
  DataQuality,
  DemoRole,
  RiskBand,
  TenantHealth,
} from './types';

export const roleLabels: Record<DemoRole, string> = {
  empresa: 'Empresa',
  'super-admin': 'Super admin',
  operador: 'Operador',
};

export const rolePaths: Record<DemoRole, string> = {
  empresa: '/empresa',
  'super-admin': '/super-admin',
  operador: '/operador',
};

export const riskBandLabels: Record<RiskBand, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
};

export const caseStatusLabels: Record<CaseStatus, string> = {
  open: 'Aberto',
  in_review: 'Em revisão',
  waiting_evidence: 'Aguardando evidência',
  escalated: 'Escalado',
  closed: 'Concluído',
};

export const qualityLabels: Record<DataQuality, string> = {
  complete: 'Completa',
  partial: 'Parcial',
  insufficient: 'Insuficiente',
};

export const healthLabels: Record<TenantHealth, string> = {
  healthy: 'Saudável',
  degraded: 'Degradado',
  incident: 'Incidente',
};

export const severityLabels: Record<AlertSeverity, string> = {
  info: 'Informativo',
  warning: 'Atenção',
  danger: 'Crítico',
};

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso));
}
