// Which workspace a tenant member lands on, derived only from the
// server-confirmed capabilities of their membership (never from a role name
// sent by the browser). Mirrors the three lines of defence in Lucimara's
// process: 1st line operator, 2nd line analyst and MLRO, 3rd line auditor.

export type WorkspacePersona = 'mlro' | 'analyst' | 'operator' | 'auditor' | 'member';

export interface PersonaCapabilities {
  caseDecide: boolean;
  auditView: boolean;
  customerManage: boolean;
}

export function personaFromCapabilities(caps: PersonaCapabilities): WorkspacePersona {
  if (caps.caseDecide) return 'mlro';
  if (caps.auditView && caps.customerManage) return 'analyst';
  if (caps.customerManage) return 'operator';
  if (caps.auditView) return 'auditor';
  return 'member';
}
