import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  CheckBadgeIcon,
  CurrencyDollarIcon,
  DocumentArrowUpIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import type {
  DisputeRatioSnapshot,
  PayPalDispute,
  Milestone,
  UserRole,
} from '../../types';
import {
  getActiveMilestone,
  getLatestDispute,
  getVerifiedDeliverable,
  formatRatioDisplay,
  formatShortTime,
} from '../../lib/workflow';

const DEFAULT_DISPUTE_REASON = 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED';
const DEFAULT_DISPUTE_AMOUNT = '350.00';
const DEFAULT_DISPUTE_NOTE =
  'The milestone deliverables did not match the agreed architecture specs and hardware SKU manifest.';

interface DisputesPageProps {
  role: UserRole;
  ratioSnapshot: DisputeRatioSnapshot | null;
  disputes: PayPalDispute[];
  milestones: Milestone[];
  busyAction: string | null;
  onDispatchOffer: (disputeId: string, amount: string) => Promise<void>;
  onSubmitEvidence: (disputeId: string) => Promise<void>;
  onClientAcceptOffer: (disputeId: string, amount: string) => Promise<void>;
  onClientRaiseDispute: (
    milestoneId: string,
    options?: { reason?: string; disputeAmount?: string; message?: string }
  ) => Promise<void>;
}

export const DisputesPage: React.FC<DisputesPageProps> = ({
  role,
  ratioSnapshot,
  disputes,
  milestones,
  busyAction,
  onDispatchOffer,
  onSubmitEvidence,
  onClientAcceptOffer,
  onClientRaiseDispute,
}) => {
  const latestDispute = getLatestDispute(disputes);
  const activeMilestone = getActiveMilestone(milestones);
  const verifiedDeliverable =
    getVerifiedDeliverable(activeMilestone) ||
    milestones.map((m) => getVerifiedDeliverable(m)).find(Boolean);
  const ratio = formatRatioDisplay(ratioSnapshot);

  const isChargeback = latestDispute?.dispute_life_cycle_stage === 'CHARGEBACK';
  const [branchTab, setBranchTab] = useState<'inquiry' | 'chargeback'>(
    isChargeback ? 'chargeback' : 'inquiry'
  );

  // Client dispute composer inputs (prefilled defaults + $10 fallback)
  const [disputeReason, setDisputeReason] = useState(DEFAULT_DISPUTE_REASON);
  const [disputeAmountInput, setDisputeAmountInput] = useState(DEFAULT_DISPUTE_AMOUNT);
  const [disputeNote, setDisputeNote] = useState(DEFAULT_DISPUTE_NOTE);

  useEffect(() => {
    if (isChargeback) {
      setBranchTab('chargeback');
    }
  }, [isChargeback]);

  const parsedCustomAmt = parseFloat(disputeAmountInput);
  const isCustomAmtFallback = isNaN(parsedCustomAmt) || parsedCustomAmt <= 0;
  const effectiveCustomAmt = isCustomAmtFallback ? '10.00' : parsedCustomAmt.toFixed(2);
  const disputingActiveMilestone = Boolean(
    activeMilestone && busyAction === `client:dispute:${activeMilestone.id}`
  );
  const acceptingOffer = Boolean(
    latestDispute && busyAction === `dispute:accept:${latestDispute.dispute_id}`
  );
  const dispatchingOffer = Boolean(
    latestDispute && busyAction === `dispute:offer:${latestDispute.dispute_id}`
  );
  const submittingEvidence = Boolean(
    latestDispute && busyAction === `dispute:evidence:${latestDispute.dispute_id}`
  );

  const renderClientDisputeComposer = () =>
    activeMilestone ? (
      <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#57534E]">
            Dispute Inquiry Details (prefilled defaults · $10.00 min fallback)
          </span>
          <span className="text-[11px] font-mono text-[#78716C]">
            Claim: ${effectiveCustomAmt} USD
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label
              htmlFor="dispute-composer-reason"
              className="block text-[11px] font-semibold text-[#57534E] mb-1"
            >
              Reason
            </label>
            <select
              id="dispute-composer-reason"
              name="disputeComposerReason"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#E5E0D8] bg-white"
            >
              <option value="MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED">
                Not as described (Default)
              </option>
              <option value="ITEM_NOT_RECEIVED">Deliverable not received</option>
              <option value="UNAUTHORIZED">Unauthorized milestone charge</option>
              <option value="BILLING_ERROR">Incorrect invoice amount</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="dispute-composer-amount"
              className="block text-[11px] font-semibold text-[#57534E] mb-1"
            >
              Claim Amount ($ · default 350.00)
            </label>
            <input
              id="dispute-composer-amount"
              name="disputeComposerAmount"
              type="number"
              step="10"
              value={disputeAmountInput}
              onChange={(e) => setDisputeAmountInput(e.target.value)}
              placeholder="350.00"
              className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-[#E5E0D8] bg-white"
            />
          </div>
          <div>
            <label
              htmlFor="dispute-composer-note"
              className="block text-[11px] font-semibold text-[#57534E] mb-1"
            >
              Note to Merchant
            </label>
            <input
              id="dispute-composer-note"
              name="disputeComposerNote"
              type="text"
              value={disputeNote}
              onChange={(e) => setDisputeNote(e.target.value)}
              placeholder={DEFAULT_DISPUTE_NOTE}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#E5E0D8] bg-white"
            />
          </div>
        </div>
        {isCustomAmtFallback && (
          <p className="text-[11px] text-amber-800">
            Non-positive claim amount normalized to $10.00 USD minimum fallback.
          </p>
        )}
      </div>
    ) : null;

  const proximity = Math.min((ratio.ratio / 0.015) * 100, 100);
  const disputeAmt = latestDispute?.dispute_amount?.value || '350.00';
  const offerAmt = latestDispute?.offer?.seller_offered_amount?.value || disputeAmt;
  const isResolved = latestDispute?.status === 'RESOLVED';
  const isUnderReview = latestDispute?.status === 'UNDER_REVIEW';
  const isWaitingBuyer = latestDispute?.status === 'WAITING_FOR_BUYER_RESPONSE';

  const rawKnn = verifiedDeliverable?.verificationDetails?.elasticKnnScore;
  const knnPct = typeof rawKnn === 'number' ? (rawKnn * 100).toFixed(1) : '85.9';
  const skuMatch = verifiedDeliverable?.verificationDetails?.channel3SkuMatch || 'CH3-TECH-88921';

  // CLIENT VIEW: Just dispute status and Accept / Raise buttons
  if (role === 'CLIENT') {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold text-[#1C1917] tracking-tight">Disputes</h1>
          <p className="text-xs text-[#57534E] mt-0.5">
            Review active inquiries, accept settlement offers, or raise a dispute on a milestone.
          </p>
        </div>

        {latestDispute ? (
          <div className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E0D8]">
              <div>
                <span className="text-xs font-mono text-[#78716C] block">
                  {latestDispute.dispute_id} · {latestDispute.dispute_life_cycle_stage}
                </span>
                <h2 className="text-base font-bold text-[#1C1917] mt-0.5">
                  ${disputeAmt} USD Claim
                </h2>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  isResolved
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {latestDispute.status.replace(/_/g, ' ')}
              </span>
            </div>

            <p className="text-xs text-[#57534E] leading-relaxed">
              {isResolved
                ? `Settlement accepted ($${offerAmt} USD refunded). Inquiry closed with $0 dispute fee.`
                : isWaitingBuyer && !isChargeback
                ? `Merchant proposed an instant $${offerAmt} USD refund to resolve this inquiry without escalation.`
                : isUnderReview
                ? 'Merchant submitted representment evidence; PayPal is reviewing the claim.'
                : isChargeback
                ? 'Escalated chargeback open; pre-escalation settlement is unavailable.'
                : 'Inquiry opened; waiting for merchant settlement offer or response.'}
            </p>

            {latestDispute.messages && latestDispute.messages.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#E5E0D8]">
                <span className="text-[11px] font-semibold text-[#78716C] block">
                  Dispute Thread
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {latestDispute.messages.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8] text-xs"
                    >
                      <div className="flex justify-between text-[11px] font-mono text-[#78716C] mb-0.5">
                        <span className="font-semibold text-[#1C1917]">{m.posted_by}</span>
                        <span>{formatShortTime(m.time_posted)}</span>
                      </div>
                      <p className="text-[#57534E]">{m.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {renderClientDisputeComposer()}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {isWaitingBuyer && !isChargeback && (
                <button
                  type="button"
                  disabled={acceptingOffer}
                  onClick={() => onClientAcceptOffer(latestDispute.dispute_id, offerAmt)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white shadow-subtle transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {acceptingOffer ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckBadgeIcon className="w-4 h-4" />
                  )}
                  <span>Accept ${offerAmt} Settlement</span>
                </button>
              )}

              {activeMilestone && (
                <button
                  type="button"
                  disabled={disputingActiveMilestone}
                  onClick={() =>
                    activeMilestone &&
                    onClientRaiseDispute(activeMilestone.id, {
                      reason: disputeReason,
                      disputeAmount: effectiveCustomAmt,
                      message: disputeNote.trim() || DEFAULT_DISPUTE_NOTE,
                    })
                  }
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {disputingActiveMilestone ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin text-amber-700" />
                  ) : (
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-700" />
                  )}
                  <span>Raise New Dispute</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#E5E0D8] rounded-xl p-6 shadow-subtle space-y-3">
            <h2 className="text-sm font-bold text-[#1C1917]">No active disputes</h2>
            <p className="text-xs text-[#57534E]">
              All escrow transactions are in good standing. If a deliverable does not match agreed
              specifications, you can open a dispute inquiry below.
            </p>
            {renderClientDisputeComposer()}
            {activeMilestone && (
              <button
                type="button"
                disabled={disputingActiveMilestone}
                onClick={() =>
                  activeMilestone &&
                  onClientRaiseDispute(activeMilestone.id, {
                    reason: disputeReason,
                    disputeAmount: effectiveCustomAmt,
                    message: disputeNote.trim() || DEFAULT_DISPUTE_NOTE,
                  })
                }
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 transition disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {disputingActiveMilestone ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin text-amber-700" />
                ) : (
                  <ExclamationTriangleIcon className="w-4 h-4 text-amber-700" />
                )}
                <span>Raise Dispute Inquiry</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // MERCHANT VIEW
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#1C1917] tracking-tight">Disputes</h1>
          <p className="text-xs text-[#57534E] mt-0.5">
            Monitor the 1.50% dispute fee cliff, settle inquiries at $0 fee, or file formal evidence.
          </p>
        </div>

        {/* Tabs: Inquiry (Branch A) | Chargeback (Branch B) */}
        <div
          role="tablist"
          aria-label="Dispute resolution branches"
          className="inline-flex bg-[#F4F1EA] p-1 rounded-lg border border-[#E5E0D8]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={branchTab === 'inquiry'}
            onClick={() => setBranchTab('inquiry')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              branchTab === 'inquiry'
                ? 'bg-white text-[#1C1917] shadow-subtle'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Inquiry (Branch A)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={branchTab === 'chargeback'}
            onClick={() => setBranchTab('chargeback')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              branchTab === 'chargeback'
                ? 'bg-white text-[#1C1917] shadow-subtle'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Chargeback (Branch B)
          </button>
        </div>
      </div>

      {/* Top Row: Ratio Gauge + Open Dispute Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Ratio Gauge */}
        <div className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1C1917]">90-Day Dispute Ratio</h2>
            <span className="text-xs font-mono text-[#57534E]">
              {ratio.totalDisputes90d} / {ratio.totalSales90d} sales
            </span>
          </div>

          <div className="flex items-center gap-5 bg-[#F9F8F5] border border-[#E5E0D8] rounded-xl p-4">
            <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="#E5E0D8" strokeWidth="8" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={
                    ratio.isHighVolume ? '#DC2626' : ratio.isWarning ? '#D97706' : '#0070BA'
                  }
                  strokeWidth="8"
                  strokeDasharray={251.2}
                  strokeDashoffset={251.2 - (251.2 * Math.min(proximity, 100)) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-bold font-mono text-[#1C1917]">
                  {ratio.percent}%
                </span>
                <span className="text-[10px] text-[#78716C]">/ 1.50%</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs flex-1">
              <div className="flex justify-between">
                <span className="text-[#57534E]">Tier:</span>
                <span className="font-semibold text-[#1C1917]">
                  {ratio.isHighVolume ? 'High Volume ($30/claim)' : 'Standard Tier'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#57534E]">Branch A Offer Fee:</span>
                <span className="font-semibold text-emerald-700">$0.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#57534E]">Escalated Fee:</span>
                <span className="font-semibold text-[#1C1917]">
                  {ratio.isHighVolume ? '$30.00 non-refundable' : '$15.00 (waived on win)'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="w-full bg-[#E5E0D8] rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  ratio.isHighVolume
                    ? 'bg-red-600'
                    : ratio.isWarning
                    ? 'bg-amber-500'
                    : 'bg-[#0070BA]'
                }`}
                style={{ width: `${Math.min(proximity, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-[#78716C]">
              <span>0.0%</span>
              <span>1.25% Warning</span>
              <span>1.50% Cliff</span>
            </div>
          </div>
        </div>

        {/* Open Dispute Card */}
        <div className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle flex flex-col justify-between space-y-3">
          {latestDispute ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-[#1C1917]">
                    Dispute {latestDispute.dispute_id}
                  </h2>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                      isResolved
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {latestDispute.status}
                  </span>
                </div>
                <div className="text-xs text-[#57534E] space-y-1">
                  <div>
                    Stage:{' '}
                    <span className="font-mono font-semibold text-[#1C1917]">
                      {latestDispute.dispute_life_cycle_stage}
                    </span>{' '}
                    · Amount:{' '}
                    <span className="font-mono font-semibold text-[#1C1917]">
                      ${disputeAmt} USD
                    </span>
                  </div>
                  <div className="text-[11px] text-[#78716C] font-mono">
                    Reason: {latestDispute.reason}
                  </div>
                </div>

                {latestDispute.messages && latestDispute.messages.length > 0 && (
                  <div className="pt-2 border-t border-[#E5E0D8] space-y-1.5 max-h-32 overflow-y-auto">
                    {latestDispute.messages.map((m, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8] text-[11px]"
                      >
                        <div className="flex justify-between font-mono text-[10px] text-[#78716C]">
                          <span className="font-bold text-[#1C1917]">{m.posted_by}</span>
                          <span>{formatShortTime(m.time_posted)}</span>
                        </div>
                        <p className="text-[#57534E] mt-0.5">{m.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#E5E0D8] text-xs text-[#57534E]">
                {isResolved
                  ? 'Resolved cleanly via pre-escalation settlement.'
                  : isChargeback
                  ? 'Formal chargeback open — use Chargeback (Branch B) to submit evidence.'
                  : 'Open inquiry — use Inquiry (Branch A) to settle at $0 fee.'}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col justify-center text-center py-6 space-y-1">
              <h2 className="text-sm font-bold text-[#1C1917]">No open disputes</h2>
              <p className="text-xs text-[#57534E]">
                Merchant dispute protection is active. Any client inquiry or simulated dispute will
                appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Branch A: Inquiry */}
      {branchTab === 'inquiry' && (
        <div className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#1C1917]">
                Pre-Escalation Settlement (Branch A · $0 Fee)
              </h3>
              <p className="text-xs text-[#57534E] mt-0.5">
                Resolve an open inquiry directly with the buyer before it escalates into a formal
                chargeback.
              </p>
            </div>

            <button
              type="button"
              disabled={
                !latestDispute ||
                isResolved ||
                isUnderReview ||
                isChargeback ||
                isWaitingBuyer ||
                dispatchingOffer
              }
              onClick={() =>
                latestDispute && onDispatchOffer(latestDispute.dispute_id, disputeAmt)
              }
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white shadow-subtle transition disabled:opacity-40 flex items-center gap-1.5"
            >
              {dispatchingOffer ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <CurrencyDollarIcon className="w-4 h-4" />
              )}
              <span>
                {!latestDispute
                  ? 'No Active Inquiry'
                  : isResolved
                  ? 'Settlement Accepted'
                  : isChargeback
                  ? 'Offer Locked (Chargeback)'
                  : isUnderReview
                  ? 'Under Adjudication'
                  : isWaitingBuyer
                  ? 'Offer Dispatched'
                  : `Dispatch $${disputeAmt} Offer`}
              </span>
            </button>
          </div>

          {latestDispute && isWaitingBuyer && !isChargeback && (
            <div className="bg-[#E6F2FA]/60 border border-[#0070BA]/30 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-[#1C1917]">
                Offer of <strong>${offerAmt} USD</strong> sent. Switch to Client view (or accept
                directly) to complete resolution.
              </span>
              <button
                type="button"
                disabled={acceptingOffer}
                onClick={() => onClientAcceptOffer(latestDispute.dispute_id, offerAmt)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-[#F4F1EA] text-[#0070BA] border border-[#0070BA]/30 disabled:opacity-50"
              >
                {acceptingOffer ? 'Accepting...' : `Client Accept $${offerAmt}`}
              </button>
            </div>
          )}

          {latestDispute && isResolved && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-emerald-700 flex-shrink-0" />
              <span>
                Settled at $0 dispute fee. Rolling ratio restored to {ratio.percent}%.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Branch B: Chargeback */}
      {branchTab === 'chargeback' && (
        <div className="space-y-5">
          {/* 10-Day SLA Bar + Actions */}
          <div className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#1C1917]">
                  Formal Representment &amp; 10-Day SLA
                </h3>
                <p className="text-xs text-[#57534E] mt-0.5">
                  Submit compiled delivery proof and audit logs ahead of the seller response
                  deadline.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isChargeback && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#F4F1EA] text-[#57534E] border border-[#E5E0D8]">
                    <LockClosedIcon className="w-3.5 h-3.5" />
                    Offer Locked
                  </span>
                )}

                <a
                  href={api.getEvidencePdfUrl(latestDispute?.dispute_id || 'PP-D-40193')}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-[#F4F1EA] text-[#0070BA] border border-[#0070BA]/40 inline-flex items-center gap-1.5"
                >
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                  <span>Preview Raw PDF</span>
                </a>

                <button
                  type="button"
                  disabled={!latestDispute || isResolved || isUnderReview || submittingEvidence}
                  onClick={() =>
                    latestDispute && onSubmitEvidence(latestDispute.dispute_id)
                  }
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white shadow-subtle transition disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  {submittingEvidence ? (
                    <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <DocumentArrowUpIcon className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isUnderReview ? 'Evidence Filed' : 'Upload Evidence'}
                  </span>
                </button>
              </div>
            </div>

            {/* 10-Day SLA Bar */}
            <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[#1C1917]">
                  10-Day Seller Response SLA
                </span>
                <span className="font-mono text-[11px] text-[#57534E]">
                  Assigned: dispute-ops@aegis.corp (24h review)
                </span>
              </div>
              <div className="w-full bg-[#E5E0D8] rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    isUnderReview ? 'bg-emerald-600 w-3/4' : 'bg-[#0070BA] w-1/4'
                  }`}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-[#78716C]">
                <span>Day 0 Opened</span>
                <span className="text-[#0070BA] font-semibold">Day 2 Evidence Staged</span>
                <span className="text-red-700 font-semibold">Day 10 Hard Deadline</span>
              </div>
            </div>
          </div>

          {/* A4 PDF Preview (2-page) */}
          <div className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle space-y-4">
            <h3 className="text-sm font-bold text-[#1C1917]">
              A4 Legal Evidence Bundle Preview
            </h3>
            <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-xl p-5 flex flex-col md:flex-row gap-5 justify-center items-stretch">
              {/* Page 1 */}
              <div className="bg-white border border-[#D6D0C5] rounded p-5 max-w-sm w-full text-[11px] text-[#1C1917] space-y-3 shadow-subtle">
                <div className="border-b border-[#1C1917] pb-2 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-xs uppercase">PayPal Dispute Defense</h4>
                    <span className="font-mono text-[10px] text-[#57534E]">
                      Ref: {latestDispute?.dispute_id || 'PP-D-40193'} · Page 1 of 2
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-[#F4F1EA] px-2 py-0.5 rounded">
                    VERIFIED
                  </span>
                </div>

                <div className="p-2.5 bg-[#F9F8F5] rounded border border-[#E5E0D8] space-y-1 font-mono text-[10px]">
                  <div>Buyer IP: 203.0.113.42</div>
                  <div className="truncate">
                    SHA-256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4...
                  </div>
                  <div>SOW Signed: 2026-11-10T14:32:00Z</div>
                </div>

                <p className="text-[#57534E] leading-relaxed italic text-[10px]">
                  &ldquo;Deliverable matches contracted SOW scope with SKU {skuMatch} and{' '}
                  {knnPct}% authenticity similarity.&rdquo;
                </p>
              </div>

              {/* Page 2 */}
              <div className="bg-white border border-[#D6D0C5] rounded p-5 max-w-sm w-full text-[11px] text-[#1C1917] space-y-3 shadow-subtle">
                <div className="border-b border-[#1C1917] pb-2 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-xs uppercase">Immutable Audit Proof</h4>
                    <span className="font-mono text-[10px] text-[#57534E]">
                      Ref: {latestDispute?.dispute_id || 'PP-D-40193'} · Page 2 of 2
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded">
                    CRC32 OK
                  </span>
                </div>

                <ul className="list-disc pl-4 space-y-1 text-[10px] text-[#57534E]">
                  <li>Access logged from IP 203.0.113.42 at 2026-11-10T14:32:00Z</li>
                  <li>Contract terms accepted via OAuth 2.0 handshake</li>
                  <li>Catalog SKU {skuMatch} verified against product spec</li>
                  <li>SafeGate HITL signature: sec-lead@aegis.corp</li>
                </ul>

                <div className="pt-2 border-t border-[#E5E0D8] text-[10px] text-[#78716C] flex justify-between">
                  <span>412.8 KB (&lt;10MB limit)</span>
                  <span>application/pdf</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisputesPage;

