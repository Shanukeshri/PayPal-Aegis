import type {
  Milestone,
  PayPalDispute,
  DisputeRatioSnapshot,
  StepId,
} from '../types';

export function getActiveMilestone(milestones: Milestone[]): Milestone | undefined {
  return (
    milestones.find((m) => m.status === 'VERIFIED') ||
    milestones.find((m) => m.status === 'REAUTHORIZED' || m.status === 'AUTHORIZED') ||
    [...milestones].reverse().find((m) => m.status === 'CAPTURED') ||
    milestones.find((m) => m.status !== 'DRAFT') ||
    milestones[0]
  );
}

export function getVerifiedDeliverable(milestone?: Milestone) {
  return milestone?.deliverables?.find((d) => d.verificationDetails) || milestone?.deliverables?.[0];
}

export async function computeFileSha256Hex(file: File): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
}

export function getLatestDispute(disputes: PayPalDispute[]): PayPalDispute | undefined {
  return disputes.length > 0 ? disputes[disputes.length - 1] : undefined;
}

export function getEscrowTotals(milestones: Milestone[]) {
  const heldAmount = milestones
    .filter((m) => m.status === 'AUTHORIZED' || m.status === 'REAUTHORIZED' || m.status === 'VERIFIED')
    .reduce((sum, m) => sum + parseFloat(m.amount.value || '0'), 0);

  const settledAmount = milestones
    .filter((m) => m.status === 'CAPTURED')
    .reduce((sum, m) => sum + parseFloat(m.amount.value || '0'), 0);

  return { heldAmount, settledAmount };
}

export function isMilestoneMutated(milestone: Milestone): boolean {
  return Boolean(
    milestone.activeAuthorizationId &&
      milestone.originalAuthorizationId &&
      milestone.activeAuthorizationId !== milestone.originalAuthorizationId
  );
}



export function formatHoldStatusLabel(status: Milestone['status']): string {
  switch (status) {
    case 'AUTHORIZED':
      return 'Authorized';
    case 'REAUTHORIZED':
      return '72h auto-renewed';
    case 'VERIFIED':
      return 'Verified';
    case 'CAPTURED':
      return 'Settled';
    case 'VOIDED':
      return 'Voided';
    case 'EXPIRED':
      return 'Expired';
    case 'FAILED':
      return 'Failed';
    default:
      return 'Draft';
  }
}

export function deriveWorkflowStep(
  milestones: Milestone[],
  disputes: PayPalDispute[]
): StepId {
  if (disputes.length > 0) return 4;
  if (milestones.some((m) => m.status === 'VERIFIED' || m.status === 'CAPTURED')) return 3;
  if (milestones.some((m) => m.status === 'REAUTHORIZED' || isMilestoneMutated(m))) return 2;
  return 1;
}

export function formatRatioDisplay(ratioSnapshot: DisputeRatioSnapshot | null) {
  const ratio = ratioSnapshot?.ratio ?? 0.0095;
  const percent = (ratio * 100).toFixed(2);
  const isHighVolume = ratioSnapshot?.tier === 'HIGH_VOLUME' || ratio >= 0.015;
  const isWarning = ratio >= 0.012 && !isHighVolume;
  return {
    ratio,
    percent,
    isHighVolume,
    isWarning,
    totalSales90d: ratioSnapshot?.totalSales90d ?? 211,
    totalDisputes90d: ratioSnapshot?.totalDisputes90d ?? 2,
  };
}

export function formatShortTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function generateUuidV4(): string {
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall back when Clipboard write permission is denied (e.g. restricted or headless frames)
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  } catch {
    // Swallow so restricted browser contexts never raise unhandled promise rejections
  }
}


