import React from 'react';
import {
  CheckIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  LockClosedIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type {
  Milestone,
  PayPalDispute,
  HITLApprovalRequest,
  DisputeRatioSnapshot,
  EcosystemEvent,
  UserRole,
  NavPage,
} from '../../types';
import {
  getActiveMilestone,
  getLatestDispute,
  getEscrowTotals,
  deriveWorkflowStep,
  formatRatioDisplay,
  formatShortTime,
} from '../../lib/workflow';

interface OverviewPageProps {
  role: UserRole;
  milestones: Milestone[];
  disputes: PayPalDispute[];
  pendingApprovals: HITLApprovalRequest[];
  ratioSnapshot: DisputeRatioSnapshot | null;
  events: EcosystemEvent[];
  busyAction: string | null;
  onNavigate: (page: NavPage) => void;
  onSeedContract: () => Promise<void>;
  onLockMilestoneHold: (milestoneId: string) => Promise<void>;
  onFastForwardDay3: (milestoneId: string) => Promise<void>;
  onVerifyDeliverable: (milestoneId: string) => Promise<void>;
  onApproveHitl: (approvalId: string) => Promise<void>;
  onClientApproveDeliverable: (milestoneId: string) => Promise<void>;
  onDispatchOffer: (disputeId: string, amount: string) => Promise<void>;
  onSubmitEvidence: (disputeId: string) => Promise<void>;
  onClientAcceptOffer: (disputeId: string, amount: string) => Promise<void>;
}

const PROGRESS_STEPS: Array<{ id: 1 | 2 | 3 | 4; label: string; targetPage: NavPage }> = [
  { id: 1, label: 'Escrow', targetPage: 'escrow' },
  { id: 2, label: 'Renew', targetPage: 'escrow' },
  { id: 3, label: 'Verify', targetPage: 'delivery' },
  { id: 4, label: 'Dispute', targetPage: 'disputes' },
];

function actorLabel(actor: string) {
  if (actor === 'CLIENT') return 'Client';
  if (actor === 'BUSINESS') return 'Merchant';
  if (actor === 'PAYPAL_ENGINE') return 'PayPal';
  return 'All';
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  role,
  milestones,
  disputes,
  pendingApprovals,
  ratioSnapshot,
  events,
  busyAction,
  onNavigate,
  onSeedContract,
  onLockMilestoneHold,
  onFastForwardDay3,
  onVerifyDeliverable,
  onApproveHitl,
  onClientApproveDeliverable,
  onDispatchOffer,
  onSubmitEvidence,
  onClientAcceptOffer,
}) => {
  const activeMilestone = getActiveMilestone(milestones);
  const latestDispute = getLatestDispute(disputes);
  const { heldAmount, settledAmount } = getEscrowTotals(milestones);
  const currentStep = deriveWorkflowStep(milestones, disputes);
  const ratio = formatRatioDisplay(ratioSnapshot);
  const recentEvents = events.slice(0, 3);
  const nextDraftMilestone = milestones.find((m) => m.status === 'DRAFT');
  const hasAnyActiveMilestone = milestones.some((m) => m.status !== 'DRAFT');

  // Derive single status card + single primary action for active role & current step
  const statusCard = (() => {
    if (milestones.length === 0 || !hasAnyActiveMilestone) {
      return {
        stepLabel: 'Step 1 · Escrow',
        title: 'No active escrow hold',
        description:
          'Initialize the milestone contract to authorize funds in escrow before work begins.',
        ctaLabel: 'Lock Milestone 1 Hold',
        loading:
          busyAction === 'seed' ||
          busyAction === 'custom-seed' ||
          Boolean(busyAction?.startsWith('hold:')),
        onCta: () =>
          milestones[0] ? onLockMilestoneHold(milestones[0].id) : onSeedContract(),
      };
    }

    if (latestDispute && latestDispute.status !== 'RESOLVED') {
      const disputeAmt = latestDispute.dispute_amount?.value || '350.00';
      const offerAmt =
        latestDispute.offer?.seller_offered_amount?.value || disputeAmt;

      if (role === 'CLIENT') {
        if (
          latestDispute.status === 'WAITING_FOR_BUYER_RESPONSE' &&
          latestDispute.dispute_life_cycle_stage !== 'CHARGEBACK'
        ) {
          return {
            stepLabel: 'Step 4 · Dispute',
            title: `Settlement offer received (${latestDispute.dispute_id})`,
            description: `Merchant proposed a $${offerAmt} USD instant refund to close this inquiry with $0 dispute fee.`,
            ctaLabel: `Accept $${offerAmt} Settlement`,
            loading: Boolean(busyAction?.startsWith('dispute:accept:')),
            onCta: () => onClientAcceptOffer(latestDispute.dispute_id, offerAmt),
          };
        }
        return {
          stepLabel: 'Step 4 · Dispute',
          title: `Dispute ${latestDispute.dispute_id} (${latestDispute.dispute_life_cycle_stage})`,
          description: `Claim for $${disputeAmt} USD is currently ${latestDispute.status.replace(/_/g, ' ').toLowerCase()}.`,
          ctaLabel: 'View Dispute',
          loading: false,
          onCta: () => onNavigate('disputes'),
        };
      }

      // MERCHANT
      if (latestDispute.status === 'WAITING_FOR_SELLER_RESPONSE') {
        if (latestDispute.dispute_life_cycle_stage === 'CHARGEBACK') {
          return {
            stepLabel: 'Step 4 · Dispute',
            title: `Escalated claim requires evidence (${latestDispute.dispute_id})`,
            description: `$${disputeAmt} USD chargeback opened. Pre-escalation offer is locked; submit the compiled evidence bundle.`,
            ctaLabel: 'Upload Evidence Bundle',
            loading: Boolean(busyAction?.startsWith('dispute:evidence:')),
            onCta: () => onSubmitEvidence(latestDispute.dispute_id),
          };
        }
        return {
          stepLabel: 'Step 4 · Dispute',
          title: `Open inquiry (${latestDispute.dispute_id})`,
          description: `$${disputeAmt} USD inquiry received. Dispatch a $0-fee settlement offer before it escalates.`,
          ctaLabel: `Dispatch $${disputeAmt} Offer`,
          loading: Boolean(busyAction?.startsWith('dispute:offer:')),
          onCta: () => onDispatchOffer(latestDispute.dispute_id, disputeAmt),
        };
      }

      if (latestDispute.status === 'WAITING_FOR_BUYER_RESPONSE') {
        return {
          stepLabel: 'Step 4 · Dispute',
          title: `Offer sent (${latestDispute.dispute_id})`,
          description: `Waiting for client acceptance on your $${offerAmt} USD settlement offer.`,
          ctaLabel: 'Open Disputes',
          loading: false,
          onCta: () => onNavigate('disputes'),
        };
      }

      return {
        stepLabel: 'Step 4 · Dispute',
        title: `Evidence under review (${latestDispute.dispute_id})`,
        description: `Representment bundle submitted to PayPal adjudication.`,
        ctaLabel: 'Open Disputes',
        loading: false,
        onCta: () => onNavigate('disputes'),
      };
    }

    if (activeMilestone?.status === 'VERIFIED') {
      if (role === 'CLIENT') {
        return {
          stepLabel: 'Step 3 · Verify',
          title: 'Deliverable verified and ready for sign-off',
          description: `${activeMilestone.name} ($${activeMilestone.amount.value} USD) passed verification. Approve to release escrow funds.`,
          ctaLabel: 'Approve & Release Funds',
          loading: Boolean(busyAction?.startsWith('client:approve:')),
          onCta: () => onClientApproveDeliverable(activeMilestone.id),
        };
      }

      const pendingApproval = pendingApprovals[0];
      if (pendingApproval) {
        return {
          stepLabel: 'Step 3 · Verify',
          title: 'Capture awaiting SafeGate approval',
          description: `$${activeMilestone.amount.value} USD release for ${activeMilestone.name} is staged for approval.`,
          ctaLabel: 'Approve & Execute Capture',
          loading: Boolean(busyAction?.startsWith('hitl:approve:')),
          onCta: () => onApproveHitl(pendingApproval.id),
        };
      }

      return {
        stepLabel: 'Step 3 · Verify',
        title: 'Deliverable verified — awaiting client sign-off',
        description: `${activeMilestone.name} is ready for client inspection and release.`,
        ctaLabel: 'View Delivery',
        loading: false,
        onCta: () => onNavigate('delivery'),
      };
    }

    if (activeMilestone?.status === 'AUTHORIZED') {
      if (role === 'MERCHANT') {
        return {
          stepLabel: 'Step 1 · Escrow',
          title: `Escrow hold active ($${activeMilestone.amount.value} USD)`,
          description: `${activeMilestone.name} funds are held. Renew the 72-hour authorization window to keep the hold active.`,
          ctaLabel: 'Renew 72h Hold',
          loading: busyAction === 'fast-forward',
          onCta: () => onFastForwardDay3(activeMilestone.id),
        };
      }
      return {
        stepLabel: 'Step 1 · Escrow',
        title: `Funds safely held in escrow ($${activeMilestone.amount.value} USD)`,
        description: `Authorized for ${activeMilestone.name}. Funds remain protected until you approve the deliverable.`,
        ctaLabel: 'View Escrow Details',
        loading: false,
        onCta: () => onNavigate('escrow'),
      };
    }

    if (activeMilestone?.status === 'REAUTHORIZED') {
      if (role === 'MERCHANT') {
        return {
          stepLabel: 'Step 2 · Renew',
          title: `72h hold renewed ($${activeMilestone.amount.value} USD)`,
          description: `Authorization window extended for ${activeMilestone.name}. Upload and verify the deliverable next.`,
          ctaLabel: 'Upload & Verify Deliverable',
          loading: busyAction === 'verify-deliverable' || busyAction === 'custom-verify',
          onCta: () => onVerifyDeliverable(activeMilestone.id),
        };
      }
      return {
        stepLabel: 'Step 2 · Renew',
        title: '72-hour hold renewed automatically',
        description: `$${activeMilestone.amount.value} USD hold for ${activeMilestone.name} was extended seamlessly without card re-entry.`,
        ctaLabel: 'View Escrow Details',
        loading: false,
        onCta: () => onNavigate('escrow'),
      };
    }

    if (nextDraftMilestone) {
      return {
        stepLabel: 'Escrow Settled',
        title: `Previous milestone settled ($${settledAmount.toFixed(2)} USD)`,
        description: `${nextDraftMilestone.name} ($${nextDraftMilestone.amount.value} USD) is unlocked and ready to authorize.`,
        ctaLabel: `Lock ${nextDraftMilestone.name.split(':')[0]}`,
        loading: Boolean(busyAction?.startsWith('hold:')),
        onCta: () => onLockMilestoneHold(nextDraftMilestone.id),
      };
    }

    return {
      stepLabel: 'Complete',
      title: 'All contract milestones settled',
      description: `$${settledAmount.toFixed(2)} USD captured with no open disputes.`,
      ctaLabel: 'View Escrow Contract',
      loading: false,
      onCta: () => onNavigate('escrow'),
    };
  })();

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-lg font-bold text-[#1C1917] tracking-tight">Overview</h1>
        <p className="text-xs text-[#57534E] mt-0.5">
          {role === 'CLIENT'
            ? 'Client view · Track escrow protection, inspect deliveries, and manage settlements.'
            : 'Merchant view · Monitor held milestones, verify deliveries, and protect dispute health.'}
        </p>
      </div>

      {/* Slim 4-Step Progress Bar */}
      <div className="bg-white border border-[#E5E0D8] rounded-xl px-4 py-3 shadow-subtle">
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          {PROGRESS_STEPS.map((step, idx) => {
            const isCompleted =
              (step.id < currentStep) ||
              (step.id === 3 && activeMilestone?.status === 'CAPTURED') ||
              (step.id === 4 && latestDispute?.status === 'RESOLVED');
            const isCurrent = step.id === currentStep && !isCompleted;

            return (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(step.targetPage)}
                  className="flex items-center space-x-2 text-left group focus:outline-none"
                >
                  <span
                    className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-[#0070BA] text-white'
                        : 'bg-[#F4F1EA] text-[#78716C] border border-[#E5E0D8]'
                    }`}
                  >
                    {isCompleted ? <CheckIcon className="w-3.5 h-3.5" /> : step.id}
                  </span>
                  <span
                    className={`text-xs font-semibold whitespace-nowrap group-hover:text-[#0070BA] ${
                      isCurrent
                        ? 'text-[#0070BA]'
                        : isCompleted
                        ? 'text-[#1C1917]'
                        : 'text-[#78716C]'
                    }`}
                  >
                    {step.label}
                  </span>
                </button>

                {idx < PROGRESS_STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 min-w-[20px] ${
                      step.id < currentStep ? 'bg-emerald-500' : 'bg-[#E5E0D8]'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* One Current Step Status Card with One Primary Button */}
      <div className="bg-white border border-[#E5E0D8] rounded-xl p-6 shadow-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <span className="inline-block text-[11px] font-semibold text-[#0070BA] uppercase tracking-wider">
            {statusCard.stepLabel}
          </span>
          <h2 className="text-base font-bold text-[#1C1917]">{statusCard.title}</h2>
          <p className="text-sm text-[#57534E] leading-relaxed">{statusCard.description}</p>
        </div>

        <button
          type="button"
          disabled={statusCard.loading}
          onClick={statusCard.onCta}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#0070BA] hover:bg-[#005EA6] text-white shadow-subtle transition disabled:opacity-50 whitespace-nowrap flex-shrink-0"
        >
          {statusCard.loading ? (
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRightIcon className="w-4 h-4" />
          )}
          <span>{statusCard.ctaLabel}</span>
        </button>
      </div>

      {/* 2–3 KPIs (Dispute ratio is Merchant-only) */}
      <div
        className={`grid gap-4 ${
          role === 'MERCHANT' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
        }`}
      >
        <div className="bg-white border border-[#E5E0D8] rounded-xl p-4 shadow-subtle flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#78716C] block">Held</span>
            <span className="text-xl font-bold font-mono text-[#1C1917] mt-0.5 block">
              ${heldAmount.toFixed(2)}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#E6F2FA] text-[#0070BA]">
            <LockClosedIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#E5E0D8] rounded-xl p-4 shadow-subtle flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#78716C] block">Settled</span>
            <span className="text-xl font-bold font-mono text-[#1C1917] mt-0.5 block">
              ${settledAmount.toFixed(2)}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#F4F1EA] text-[#0070BA]">
            <CurrencyDollarIcon className="w-5 h-5" />
          </div>
        </div>

        {role === 'MERCHANT' && (
          <div className="bg-white border border-[#E5E0D8] rounded-xl p-4 shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-[#78716C] block">Dispute ratio</span>
              <span
                className={`text-xl font-bold font-mono mt-0.5 block ${
                  ratio.isHighVolume
                    ? 'text-red-700'
                    : ratio.isWarning
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}
              >
                {ratio.percent}%
              </span>
            </div>
            <div
              className={`p-2.5 rounded-lg ${
                ratio.isHighVolume
                  ? 'bg-red-50 text-red-700'
                  : ratio.isWarning
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <ExclamationTriangleIcon className="w-5 h-5" />
            </div>
          </div>
        )}
      </div>

      {/* Latest 3 Activity Items */}
      <div className="bg-white border border-[#E5E0D8] rounded-xl shadow-subtle overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E0D8] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1C1917]">Recent Activity</h3>
          <button
            type="button"
            onClick={() => onNavigate('activity')}
            className="text-xs font-semibold text-[#0070BA] hover:underline"
          >
            View all →
          </button>
        </div>

        {recentEvents.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#78716C]">
            No recent activity yet.
          </div>
        ) : (
          <ul className="divide-y divide-[#E5E0D8]">
            {recentEvents.map((ev) => (
              <li key={ev.id} className="px-5 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-[#1C1917]">
                      {actorLabel(ev.sender)} → {actorLabel(ev.recipient)}
                    </span>
                    <span className="text-[#78716C]">·</span>
                    <span className="font-medium text-[#0070BA] truncate">{ev.title}</span>
                  </div>
                  <p className="text-xs text-[#57534E] mt-0.5 line-clamp-1">{ev.message}</p>
                </div>
                <span className="text-[11px] font-mono text-[#78716C] flex-shrink-0">
                  {formatShortTime(ev.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default OverviewPage;

