export type Verdict = '原生支持' | '应用层扩展' | '需要 fork' | '开源不可行';

export interface LabCheck {
  id: string;
  passed: boolean;
  detail: string;
}

export interface CommercialDecision {
  status: 'not-needed' | 'pending' | 'approved';
  sdkId?: string;
  approvedAt?: string;
}

export interface LabResult {
  labId: string;
  verdict: Verdict;
  checks: LabCheck[];
  evidence: string[];
  commercialDecision: CommercialDecision;
}

export interface LabHandle {
  run(): Promise<LabResult>;
  dispose(): Promise<void>;
}

export interface LabDefinition {
  id: string;
  title: string;
  mount(root: HTMLElement): Promise<LabHandle>;
}

const VERDICTS = new Set<Verdict>(['原生支持', '应用层扩展', '需要 fork', '开源不可行']);
const SAFE_LAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCommercialDecision(value: unknown): value is CommercialDecision {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const decision = value as Record<string, unknown>;
  if (decision.status === 'not-needed' || decision.status === 'pending') return true;
  return decision.status === 'approved' && isNonEmptyString(decision.sdkId) && isNonEmptyString(decision.approvedAt);
}

export function resultFileName(labId: string): string {
  if (!SAFE_LAB_ID.test(labId)) throw new Error('invalid labId');
  return `${labId}.json`;
}

export function assertLabResult(value: unknown): asserts value is LabResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('invalid LabResult');
  }

  const result = value as Record<string, unknown>;
  const checksValid = Array.isArray(result.checks) && result.checks.every((check) => {
    if (typeof check !== 'object' || check === null || Array.isArray(check)) return false;
    const item = check as Record<string, unknown>;
    return isNonEmptyString(item.id) && typeof item.passed === 'boolean' && isNonEmptyString(item.detail);
  });
  const evidenceValid = Array.isArray(result.evidence) && result.evidence.every(isNonEmptyString);

  if (
    !isNonEmptyString(result.labId) ||
    !SAFE_LAB_ID.test(result.labId) ||
    !VERDICTS.has(result.verdict as Verdict) ||
    !checksValid ||
    !evidenceValid ||
    !isCommercialDecision(result.commercialDecision)
  ) {
    throw new Error('invalid LabResult');
  }
}
