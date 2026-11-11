import React from 'react';
import {
  BuildingOffice2Icon,
  BoltIcon,
  ShieldCheckIcon,
  CpuChipIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentArrowUpIcon,
  ArrowPathIcon,
  HandThumbUpIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import ClientBuyerPortalView from '../client/ClientBuyerPortalView';
import type {
  Milestone,
  PayPalDispute,
  HITLApprovalRequest,
  DisputeRatioSnapshot,
  EcosystemEvent,
  StateMutationDiff,
} from '../../types';
import type { AgentKey } from '../toolbar/JudgeDemoToolbar';

interface SplitEcosystemCanvasProps {
  milestones: Milestone[];
  disputes: PayPalDispute[];
  pendingApprovals: HITLApprovalRequest[];
  ratioSnapshot: DisputeRatioSnapshot | null;
  events: EcosystemEvent[];
  diffs: StateMutationDiff[];
  activeAgent: AgentKey;
  isExecuting: boolean;
  liveAgentInfo?: { agentName: string; phase: string; status: string } | null;
  busyAction: string | null;
  onClientApproveDeliverable: (milestoneId: string) => Promise<void>;
  onClientRaiseDispute: (milestoneId: string) => Promise<void>;
  onClientAcceptOffer: (disputeId: string, amount: string) => Promise<void>;
  onMerchantFastForwardDay3: (milestoneId: string) => Promise<void>;
  onMerchantVerifyDeliverable: (milestoneId: string) => Promise<void>;
  onApproveHitl: (approvalId: string) => Promise<void>;
  onRejectHitl: (approvalId: string) => Promise<void>;
  onMerchantDispatchOffer: (disputeId: string, amount: string) => Promise<void>;
  onMerchantSubmitEvidence: (disputeId: string) => Promise<void>;
  onOpenDeepDiveTab: (tabIndex: number) => void;
}

export const SplitEcosystemCanvas: React.FC<SplitEcosystemCanvasProps> = ({
  milestones,
  disputes,
  pendingApprovals,
  ratioSnapshot,
  events,
  diffs,
  activeAgent,
  isExecuting,
  liveAgentInfo,
  busyAction,
  onClientApproveDeliverable,
  onClientRaiseDispute,
  onClientAcceptOffer,
  onMerchantFastForwardDay3,
  onMerchantVerifyDeliverable,
  onApproveHitl,
  onRejectHitl,
  onMerchantDispatchOffer,
  onMerchantSubmitEvidence,
  onOpenDeepDiveTab,
}) => {
  const latestEvent = events[0];
  const latestDiff = diffs[0];
  const activeMilestone = milestones.find((m) => m.status !== 'DRAFT') || milestones[0];
  const primaryDispute = disputes[disputes.length - 1];
  const pendingApproval = pendingApprovals[0];

  const ratioVal = ratioSnapshot?.ratio ?? 0.0133;
  const ratioPct = (ratioVal * 100).toFixed(2);
  const isCliffBreached = ratioVal >= 0.015;
  const isWarningZone = ratioVal >= 0.012 && !isCliffBreached;

  // Determine packet flow direction across the animated SVG rails
  const flowDirection: 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT' | 'BIDIRECTIONAL' = (() => {
    if (!latestEvent) return 'BIDIRECTIONAL';
    if (latestEvent.sender === 'CLIENT') return 'LEFT_TO_RIGHT';
    if (latestEvent.sender === 'BUSINESS') return 'RIGHT_TO_LEFT';
    return 'BIDIRECTIONAL';
  })();

  const packetLabel = (() => {
    if (!latestEvent) return 'Escrow Synchronized';
    switch (latestEvent.eventType) {
      case 'HOLD_CREATED':
        return 'Funds Authorized ($1,250 Hold)';
      case 'REAUTH_MUTATED':
        return '72h Auth ID Mutated & Synced';
      case 'DELIVERABLE_VERIFIED':
        return 'SHA-256 Deliverable Dispatched';
      case 'SAFEGATE_INTERCEPT':
        return 'SafeGate Firewall Paused';
      case 'CAPTURE_SETTLED':
        return 'Escrow Captured & Settled';
      case 'DISPUTE_OPENED':
        return 'Inquiry Signal Raised';
      case 'OFFER_DISPATCHED':
        return '$350 Settlement Offer Sent';
      case 'OFFER_ACCEPTED':
        return 'Settlement Accepted ($0 Fee)';
      case 'EVIDENCE_SUBMITTED':
        return 'A4 Legal Evidence Filed';
      default:
        return latestEvent.title;
    }
  })();

  const agentsList: Array<{
    key: Exclude<AgentKey, null>;
    label: string;
    subtitle: string;
  }> = [
    {
      key: 'ContractParser',
      label: 'ContractParser',
      subtitle: 'APIMatic v2 Schema Grounding',
    },
    {
      key: 'DeliveryAuditor',
      label: 'DeliveryAuditor',
      subtitle: 'Channel3 SKU + Elastic kNN',
    },
    {
      key: 'DisputeStrategist',
      label: 'DisputeStrategist',
      subtitle: '1.5% Shield + A4 Legal RAG',
    },
  ];

  const isAgentPulsing = (key: Exclude<AgentKey, null>) => {
    if (activeAgent === key && isExecuting) return true;
    if (
      liveAgentInfo &&
      liveAgentInfo.status === 'THINKING' &&
      liveAgentInfo.agentName.includes(key)
    ) {
      return true;
    }
    return false;
  };

  const offerAmount =
    primaryDispute?.offer?.seller_offered_amount?.value ||
    primaryDispute?.dispute_amount?.value ||
    '350.00';

  return (
    <section aria-label="Tripartite PayPal Ecosystem Canvas" className="space-y-2.5">
      {/* 3-Column Synchronized Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
        {/* LEFT COLUMN (4 cols): Client / Buyer */}
        <div className="xl:col-span-4">
          <ClientBuyerPortalView
            milestones={milestones}
            disputes={disputes}
            busyAction={busyAction}
            onApproveDeliverable={onClientApproveDeliverable}
            onRaiseDispute={onClientRaiseDispute}
            onAcceptOffer={onClientAcceptOffer}
          />
        </div>

        {/* CENTER COLUMN (4 cols): PayPal Aegis Arbiter & Agent Engine */}
        <div className="xl:col-span-4 bg-white border border-[#0070BA]/40 rounded-2xl p-3 shadow-subtle flex flex-col justify-between space-y-2.5 ring-1 ring-[#0070BA]/10">
          <div className="space-y-2.5">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E0D8]">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#0070BA] flex items-center justify-center text-white shadow-subtle">
                  <BoltIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0070BA]">
                    ⚡ PayPal Aegis Arbiter
                  </h3>
                  <p className="text-xs font-bold text-[#1C1917]">
                    Escrow &amp; Autonomous AI Core
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#E6F2FA] text-[#0070BA] border border-[#0070BA]/30">
                SANDBOX LIVE
              </span>
            </div>

            {/* Animated Directional SVG Packet Rails */}
            <div className="rounded-xl bg-[#F9F8F5] border border-[#E5E0D8] p-3 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#57534E]">
                <span className="text-purple-800">👤 Client</span>
                <span className="text-[#0070BA] font-mono px-2 py-0.5 rounded bg-white border border-[#E5E0D8]">
                  {packetLabel}
                </span>
                <span className="text-emerald-800">🏢 Business</span>
              </div>

              {/* SVG Directional Rail */}
              <div className="relative w-full py-1">
                <svg
                  className="w-full h-10"
                  viewBox="0 0 360 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Base Rail */}
                  <line
                    x1="16"
                    y1="20"
                    x2="344"
                    y2="20"
                    stroke="#D6D0C5"
                    strokeWidth="2.5"
                    strokeDasharray="5 5"
                  />

                  {/* Left Endpoint (Client) */}
                  <circle cx="16" cy="20" r="6" fill="#7E22CE" />
                  {/* Center Node (PayPal Aegis) */}
                  <rect
                    x="155"
                    y="7"
                    width="50"
                    height="26"
                    rx="8"
                    fill="#0070BA"
                  />
                  <text
                    x="180"
                    y="23"
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fill="#FFFFFF"
                  >
                    PAYPAL
                  </text>
                  {/* Right Endpoint (Business) */}
                  <circle cx="344" cy="20" r="6" fill="#047857" />

                  {/* Animated Packet Dot */}
                  {flowDirection === 'LEFT_TO_RIGHT' && (
                    <circle r="4.5" fill="#0070BA">
                      <animateMotion
                        dur="2.2s"
                        repeatCount="indefinite"
                        path="M 22 20 L 338 20"
                      />
                    </circle>
                  )}
                  {flowDirection === 'RIGHT_TO_LEFT' && (
                    <circle r="4.5" fill="#059669">
                      <animateMotion
                        dur="2.2s"
                        repeatCount="indefinite"
                        path="M 338 20 L 22 20"
                      />
                    </circle>
                  )}
                  {flowDirection === 'BIDIRECTIONAL' && (
                    <>
                      <circle r="4" fill="#0070BA">
                        <animateMotion
                          dur="2s"
                          repeatCount="indefinite"
                          path="M 155 20 L 22 20"
                        />
                      </circle>
                      <circle r="4" fill="#0070BA">
                        <animateMotion
                          dur="2s"
                          repeatCount="indefinite"
                          path="M 205 20 L 338 20"
                        />
                      </circle>
                    </>
                  )}
                </svg>

                <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-[#57534E]">
                  {flowDirection === 'LEFT_TO_RIGHT' ? (
                    <>
                      <span>Direction: Client ➔ PayPal ➔ Business</span>
                      <ArrowRightIcon className="w-3 h-3 text-[#0070BA]" />
                    </>
                  ) : flowDirection === 'RIGHT_TO_LEFT' ? (
                    <>
                      <ArrowLeftIcon className="w-3 h-3 text-emerald-700" />
                      <span>Direction: Business ➔ PayPal ➔ Client</span>
                    </>
                  ) : (
                    <span>Sync Direction: Client ⟷ PayPal ⟷ Business</span>
                  )}
                </div>
              </div>
            </div>

            {/* Active Autonomous Agents Telemetry */}
            <div className="rounded-xl bg-[#F9F8F5] border border-[#E5E0D8] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#57534E] flex items-center gap-1">
                  <CpuChipIcon className="w-3.5 h-3.5 text-[#0070BA]" />
                  Autonomous AI Agents (Live State)
                </span>
                {liveAgentInfo && (
                  <span className="text-[9px] font-mono text-[#0070BA] font-bold">
                    {liveAgentInfo.phase}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {agentsList.map((ag) => {
                  const pulsing = isAgentPulsing(ag.key);
                  return (
                    <div
                      key={ag.key}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition ${
                        pulsing
                          ? 'bg-[#E6F2FA] border-[#0070BA] ring-1 ring-[#0070BA]/30 font-bold'
                          : 'bg-white border-[#E5E0D8]'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            pulsing
                              ? 'bg-[#0070BA] animate-ping'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <span className="font-semibold text-[#1C1917] text-[11px]">
                          {ag.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#78716C]">
                        {pulsing ? 'EXECUTING...' : ag.subtitle}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inline State Mutation Diff Summary */}
            <div className="rounded-xl bg-white border border-[#E5E0D8] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0070BA] flex items-center gap-1">
                  <SparklesIcon className="w-3.5 h-3.5" />
                  Inline State Mutation Diff
                </span>
                <button
                  type="button"
                  onClick={() => onOpenDeepDiveTab(1)}
                  className="text-[10px] font-bold text-[#0070BA] hover:underline"
                >
                  Open Ledger &amp; Gantt →
                </button>
              </div>

              {latestDiff ? (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-[#1C1917] truncate">
                    {latestDiff.actionLabel}
                  </div>
                  {latestDiff.changes.slice(0, 2).map((c, idx) => (
                    <div
                      key={idx}
                      className="text-[10px] font-mono bg-[#F9F8F5] p-1.5 rounded border border-[#E5E0D8] flex flex-wrap items-center gap-1"
                    >
                      <span className="text-[#78716C]">{c.field}:</span>
                      <span className="line-through text-red-700">
                        {c.previousValue}
                      </span>
                      <span className="text-[#0070BA]">➔</span>
                      <span className="font-bold text-[#0070BA]">
                        {c.newValue}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[#57534E]">
                  No state mutations captured yet. Run any step above to view live diffs.
                </p>
              )}
            </div>

            {/* SafeGate Firewall Status */}
            <div
              className={`rounded-xl border p-3 flex items-center justify-between ${
                pendingApprovals.length > 0
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-[#F4F1EA] border-[#E5E0D8]'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheckIcon
                  className={`w-5 h-5 ${
                    pendingApprovals.length > 0 ? 'text-amber-700' : 'text-[#0070BA]'
                  }`}
                />
                <div>
                  <span className="text-[11px] font-bold text-[#1C1917] block">
                    SafeGate HITL Firewall
                  </span>
                  <span className="text-[10px] text-[#57534E]">
                    {pendingApprovals.length > 0
                      ? `${pendingApprovals.length} money-moving call paused`
                      : 'Fail-closed sandbox guard active'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenDeepDiveTab(2)}
                className="text-[10px] font-bold px-2 py-1 rounded bg-white text-[#0070BA] border border-[#0070BA]/30 hover:bg-[#E6F2FA] transition"
              >
                Audit Gate
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E5E0D8] flex items-center justify-between text-[10px] font-mono text-[#78716C]">
            <span>Protocol: PayPal REST v2 + Webhooks</span>
            <span>CRC-32 Verified</span>
          </div>
        </div>

        {/* RIGHT COLUMN (4 cols): Business / Merchant */}
        <div className="xl:col-span-4 bg-white border border-emerald-200 rounded-2xl p-3 shadow-subtle flex flex-col justify-between space-y-2.5 h-full">
          <div className="space-y-2.5">
            {/* Merchant Identity Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E0D8]">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <BuildingOffice2Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                      🏢 Business / Merchant
                    </h3>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      PAYEE
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#1C1917] mt-0.5">
                    Aegis Dev Studio LLC
                  </p>
                  <p className="text-[10px] text-[#78716C] font-mono">
                    merchant@aegis.sandbox.com
                  </p>
                </div>
              </div>

              <div className="text-right bg-[#F9F8F5] px-2.5 py-1.5 rounded-lg border border-[#E5E0D8]">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#78716C] block">
                  Protected Revenue
                </span>
                <span className="text-xs font-bold font-mono text-emerald-700">
                  $
                  {milestones
                    .filter((m) => m.status === 'CAPTURED')
                    .reduce((acc, m) => acc + parseFloat(m.amount.value || '0'), 0)
                    .toFixed(2)}{' '}
                  Settled
                </span>
              </div>
            </div>

            {/* Card 1: Milestone Escrow & 72h Hold Keeper */}
            <div className="rounded-xl bg-[#F9F8F5] border border-[#E5E0D8] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#1C1917] flex items-center gap-1.5">
                  <ClockIcon className="w-4 h-4 text-[#0070BA]" />
                  Milestone Escrow &amp; 72h Keeper
                </span>
                <span className="text-[10px] font-mono font-bold text-[#0070BA]">
                  {milestones.length} Milestones
                </span>
              </div>

              <div className="space-y-1.5">
                {milestones.map((m, idx) => {
                  const isMutated =
                    m.activeAuthorizationId &&
                    m.originalAuthorizationId &&
                    m.activeAuthorizationId !== m.originalAuthorizationId;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#E5E0D8] text-[11px]"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-[#1C1917] truncate block">
                          M{idx + 1}: {m.name.replace(/^Milestone \d+:\s*/i, '')}
                        </span>
                        <span className="font-mono text-[10px] text-[#78716C]">
                          ${m.amount.value}{' '}
                          {isMutated && (
                            <span className="text-[#0070BA] font-bold ml-1">
                              • ROTATED ({m.activeAuthorizationId?.slice(0, 8)}...)
                            </span>
                          )}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                          m.status === 'CAPTURED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : m.status === 'VERIFIED'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : m.status === 'AUTHORIZED' || m.status === 'REAUTHORIZED'
                            ? 'bg-[#E6F2FA] text-[#0070BA] border-[#0070BA]/30'
                            : 'bg-[#F4F1EA] text-[#78716C] border-[#E5E0D8]'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>
                  );
                })}
              </div>

              {activeMilestone?.status === 'AUTHORIZED' && (
                <button
                  type="button"
                  disabled={busyAction === 'day3'}
                  onClick={() => onMerchantFastForwardDay3(activeMilestone.id)}
                  className="w-full py-1.5 px-2.5 text-[11px] font-bold rounded-lg bg-white hover:bg-[#E6F2FA] text-[#0070BA] border border-[#0070BA]/40 transition flex items-center justify-center gap-1.5"
                >
                  <ArrowPathIcon
                    className={`w-3.5 h-3.5 ${busyAction === 'day3' ? 'animate-spin' : ''}`}
                  />
                  <span>Fast-Forward Day-3 Reauthorization</span>
                </button>
              )}
            </div>

            {/* Card 2: Deliverable Upload & SafeGate HITL Intercept */}
            <div
              className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
                pendingApproval
                  ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-200'
                  : 'bg-[#F9F8F5] border-[#E5E0D8]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#1C1917] flex items-center gap-1.5">
                  <ShieldCheckIcon className="w-4 h-4 text-[#0070BA]" />
                  Deliverable &amp; SafeGate Queue
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-[#E5E0D8] text-[#1C1917]">
                  {pendingApprovals.length} Intercepted
                </span>
              </div>

              {pendingApproval ? (
                <div className="space-y-2">
                  <div className="bg-white rounded-lg p-2.5 border border-amber-200 text-[11px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-[#0070BA]">
                        {pendingApproval.type}
                      </span>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                        {pendingApproval.riskLevel} RISK
                      </span>
                    </div>
                    <p className="text-[#57534E] leading-snug">
                      {pendingApproval.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busyAction === 'hitl-reject'}
                      onClick={() => onRejectHitl(pendingApproval.id)}
                      className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-white hover:bg-red-50 text-[#1C1917] border border-[#E5E0D8] flex items-center justify-center gap-1 transition"
                    >
                      <XCircleIcon className="w-3.5 h-3.5 text-red-600" />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      disabled={busyAction === 'hitl-approve'}
                      onClick={() => onApproveHitl(pendingApproval.id)}
                      className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white flex items-center justify-center gap-1 shadow-subtle transition"
                    >
                      {busyAction === 'hitl-approve' ? (
                        <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                      )}
                      <span>Approve &amp; Execute</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-[#57534E]">
                    {activeMilestone?.status === 'CAPTURED'
                      ? 'Deliverable verified and capture settled via SafeGate.'
                      : 'Upload proof-of-work to trigger Channel3 + Elastic kNN verification and stage SafeGate capture.'}
                  </p>
                  {activeMilestone &&
                    activeMilestone.status !== 'CAPTURED' &&
                    activeMilestone.status !== 'VERIFIED' && (
                      <button
                        type="button"
                        disabled={busyAction === 'verify'}
                        onClick={() => onMerchantVerifyDeliverable(activeMilestone.id)}
                        className="w-full py-1.5 px-2.5 text-[11px] font-bold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white shadow-subtle transition flex items-center justify-center gap-1.5"
                      >
                        <DocumentArrowUpIcon className="w-3.5 h-3.5" />
                        <span>Upload &amp; Verify Deliverable</span>
                      </button>
                    )}
                </div>
              )}
            </div>

            {/* Card 3: 1.5% Dispute Ratio Shield & Offer Dispatcher */}
            <div
              className={`rounded-xl border p-3.5 space-y-2 transition-all ${
                isCliffBreached
                  ? 'bg-red-50/70 border-red-300'
                  : isWarningZone
                  ? 'bg-amber-50/60 border-amber-300'
                  : 'bg-[#F9F8F5] border-[#E5E0D8]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#1C1917] flex items-center gap-1.5">
                  <ExclamationTriangleIcon
                    className={`w-4 h-4 ${
                      isCliffBreached
                        ? 'text-red-600'
                        : isWarningZone
                        ? 'text-amber-600'
                        : 'text-[#0070BA]'
                    }`}
                  />
                  90-Day Dispute Ratio Shield
                </span>
                <span
                  className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded border ${
                    isCliffBreached
                      ? 'bg-red-100 text-red-900 border-red-300'
                      : isWarningZone
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  }`}
                >
                  {ratioPct}% / 1.50% Cliff
                </span>
              </div>

              {primaryDispute ? (
                <div className="space-y-2">
                  <div className="bg-white rounded-lg p-2 border border-[#E5E0D8] text-[11px]">
                    <div className="flex justify-between font-mono font-bold">
                      <span>{primaryDispute.dispute_id}</span>
                      <span
                        className={
                          primaryDispute.status === 'RESOLVED'
                            ? 'text-emerald-700'
                            : 'text-amber-800'
                        }
                      >
                        {primaryDispute.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#57534E] mt-0.5">
                      {primaryDispute.status === 'RESOLVED'
                        ? 'Resolved via pre-escalation $0 fee settlement. Ratio restored cleanly to safe tier.'
                        : primaryDispute.status === 'WAITING_FOR_BUYER_RESPONSE'
                        ? `Pre-escalation $${offerAmount} offer delivered to Client. Waiting on Client acceptance.`
                        : `Active SNAD inquiry ($${primaryDispute.dispute_amount.value}). Dispatch $0-fee offer or submit A4 PDF evidence.`}
                    </p>
                  </div>

                  {primaryDispute.status !== 'RESOLVED' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={
                          busyAction === 'dispatch-offer' ||
                          primaryDispute.status === 'WAITING_FOR_BUYER_RESPONSE' ||
                          primaryDispute.status === 'UNDER_REVIEW' ||
                          primaryDispute.dispute_life_cycle_stage === 'CHARGEBACK'
                        }
                        onClick={() =>
                          onMerchantDispatchOffer(primaryDispute.dispute_id, offerAmount)
                        }
                        className="px-2 py-1.5 text-[10px] font-bold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white transition disabled:opacity-40 flex items-center justify-center gap-1"
                      >
                        <HandThumbUpIcon className="w-3.5 h-3.5" />
                        <span>
                          {primaryDispute.dispute_life_cycle_stage === 'CHARGEBACK'
                            ? 'Chargeback (PDF Only)'
                            : primaryDispute.status === 'UNDER_REVIEW'
                            ? 'Under Adjudication'
                            : primaryDispute.status === 'WAITING_FOR_BUYER_RESPONSE'
                            ? 'Offer Sent ✓'
                            : `Dispatch $${offerAmount} Offer`}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={
                          busyAction === 'submit-evidence' ||
                          primaryDispute.status === 'UNDER_REVIEW'
                        }
                        onClick={() => onMerchantSubmitEvidence(primaryDispute.dispute_id)}
                        className="px-2 py-1.5 text-[10px] font-bold rounded-lg bg-white hover:bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8] transition disabled:opacity-40 flex items-center justify-center gap-1"
                      >
                        <DocumentArrowUpIcon className="w-3.5 h-3.5 text-[#0070BA]" />
                        <span>
                          {primaryDispute.status === 'UNDER_REVIEW' ? 'Evidence Filed ✓' : 'Submit A4 PDF'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] text-[#57534E]">
                  <span>
                    Standard Tier ({ratioSnapshot?.totalDisputes90d ?? 2}/
                    {ratioSnapshot?.totalSales90d ?? 150} disputes). $0 penalty exposure.
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenDeepDiveTab(3)}
                    className="text-[10px] font-bold text-[#0070BA] hover:underline flex-shrink-0 ml-2"
                  >
                    Dispute Shield →
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-[#E5E0D8] flex items-center justify-between text-[10px] text-[#78716C]">
            <span className="font-semibold text-emerald-800">
              Merchant Protection &amp; Fee Shield Active
            </span>
            <span className="font-mono">0% Fee Cliff Exposure</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SplitEcosystemCanvas;

