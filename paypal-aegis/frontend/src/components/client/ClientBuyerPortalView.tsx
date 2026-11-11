import React, { useState } from 'react';
import {
  LockClosedIcon,
  CubeIcon,
  CheckBadgeIcon,
  HandThumbUpIcon,
  UserCircleIcon,
  ShieldCheckIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import type { Milestone, PayPalDispute } from '../../types';

interface ClientBuyerPortalViewProps {
  milestones: Milestone[];
  disputes: PayPalDispute[];
  busyAction?: string | null;
  onApproveDeliverable: (milestoneId: string) => Promise<void>;
  onRaiseDispute: (milestoneId: string) => Promise<void>;
  onAcceptOffer: (disputeId: string, amount: string) => Promise<void>;
}

export const ClientBuyerPortalView: React.FC<ClientBuyerPortalViewProps> = ({
  milestones,
  disputes,
  busyAction,
  onApproveDeliverable,
  onRaiseDispute,
  onAcceptOffer,
}) => {
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);

  const activeMilestone =
    milestones.find((m) => m.status !== 'DRAFT') || milestones[0];
  const primaryDispute = disputes[disputes.length - 1];

  const isCaptured = milestones.some((m) => m.status === 'CAPTURED');
  const isReauthorized = milestones.some((m) => m.status === 'REAUTHORIZED');
  const isVerified = milestones.some(
    (m) => m.status === 'VERIFIED' || m.status === 'CAPTURED'
  );
  const isAuthorized = milestones.some(
    (m) =>
      m.status === 'AUTHORIZED' ||
      m.status === 'REAUTHORIZED' ||
      m.status === 'VERIFIED' ||
      m.status === 'CAPTURED'
  );

  const deliverable = activeMilestone?.deliverables?.[0];
  const fileName =
    deliverable?.verificationDetails?.fileName ||
    'production_cloud_architecture_spec.pdf';
  const sha256 =
    deliverable?.sha256Hash ||
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const skuMatch =
    deliverable?.verificationDetails?.channel3SkuMatch || 'CH3-TECH-88921';
  const knnPercent = deliverable?.verificationDetails?.elasticKnnScore
    ? (deliverable.verificationDetails.elasticKnnScore * 100).toFixed(1)
    : '85.9';

  const offerAmount =
    primaryDispute?.offer?.seller_offered_amount?.value ||
    primaryDispute?.dispute_amount?.value ||
    '350.00';
  const isDisputeResolved = primaryDispute?.status === 'RESOLVED';
  const hasActiveDispute = Boolean(primaryDispute);

  const handleDownloadArtifact = () => {
    setDownloadFeedback(
      `Verified artifact "${fileName}" downloaded (SHA-256: ${sha256.slice(0, 14)}...)`
    );
    setTimeout(() => setDownloadFeedback(null), 4500);
  };

  return (
    <div className="bg-white border border-purple-200 rounded-2xl p-3 shadow-subtle flex flex-col justify-between space-y-2.5 h-full">
      {/* Column Header: Client Identity */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-[#E5E0D8]">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
              <UserCircleIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-purple-900">
                  👤 Client / Buyer
                </h3>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                  PAYER
                </span>
              </div>
              <p className="text-xs font-bold text-[#1C1917] mt-0.5">
                Acme Global Ventures LLC
              </p>
              <p className="text-[10px] text-[#78716C] font-mono">
                procurement@acmeglobal.sandbox.com
              </p>
            </div>
          </div>

          <div className="text-right bg-[#F9F8F5] px-2.5 py-1.5 rounded-lg border border-[#E5E0D8]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#78716C] block">
              Card Hold (Visa ••4112)
            </span>
            <span className="text-xs font-bold font-mono text-[#0070BA]">
              {isCaptured
                ? `$${activeMilestone?.amount.value || '1250.00'} Paid`
                : isAuthorized
                ? `$${activeMilestone?.amount.value || '1250.00'} Held`
                : '$0.00 Held'}
            </span>
          </div>
        </div>

        {/* Card 1: Live Card Authorization Hold & 72h Seamless Reauth */}
        <div
          className={`rounded-xl border p-3.5 space-y-2 transition-all ${
            isAuthorized
              ? 'bg-[#F9F8F5] border-[#0070BA]/40'
              : 'bg-[#F9F8F5] border-[#E5E0D8] opacity-75'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#1C1917] flex items-center gap-1.5">
              <LockClosedIcon className="w-4 h-4 text-[#0070BA]" />
              Card Authorization Hold
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#E6F2FA] text-[#0070BA] border border-[#0070BA]/30">
              {isCaptured
                ? 'SETTLED'
                : isReauthorized
                ? '72h AUTO-RENEWED'
                : isAuthorized
                ? 'AUTHORIZED'
                : 'AWAITING SEED'}
            </span>
          </div>

          <p className="text-[11px] text-[#57534E] leading-relaxed">
            {isCaptured
              ? `💳 $${activeMilestone?.amount.value || '1250.00'} captured on Milestone 1. Receipt #${activeMilestone?.captureId || 'CAP-SETTLED'} available.`
              : isAuthorized
              ? `🔒 $${activeMilestone?.amount.value || '1250.00'} authorized in PayPal escrow — held safely, not debited until delivery sign-off.`
              : 'No active escrow hold yet. Click Step 1 above to seed contract and place hold.'}
          </p>

          {isReauthorized && !isCaptured && (
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-[10px] font-semibold text-[#0070BA] flex items-center gap-1.5">
              <ClockIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                Seamless 72h Renewal: Hold extended automatically without re-entering card credentials.
              </span>
            </div>
          )}

          {activeMilestone && (
            <div className="pt-1.5 border-t border-[#E5E0D8] flex justify-between text-[10px] font-mono text-[#78716C]">
              <span>Order: {activeMilestone.orderId || 'Pending'}</span>
              <span className="text-[#1C1917] font-semibold truncate max-w-[140px]">
                Auth: {activeMilestone.activeAuthorizationId || 'N/A'}
              </span>
            </div>
          )}
        </div>

        {/* Card 2: Deliverable Inspection & Real Interactive Buyer Actions */}
        <div
          className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
            isVerified
              ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-200'
              : 'bg-[#F9F8F5] border-[#E5E0D8]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#1C1917] flex items-center gap-1.5">
              <CubeIcon className="w-4 h-4 text-emerald-700" />
              Deliverable Inspection
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                isVerified
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-white text-[#78716C] border-[#E5E0D8]'
              }`}
            >
              {isVerified ? 'SHA-256 VERIFIED' : 'PENDING UPLOAD'}
            </span>
          </div>

          {isVerified ? (
            <>
              <div className="text-[11px] text-[#1C1917] bg-white rounded-lg p-2 border border-[#E5E0D8] space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-[#78716C]">Artifact:</span>
                  <span className="font-semibold truncate max-w-[175px]">{fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#78716C]">Catalog + Vector:</span>
                  <span className="text-[#0070BA] font-semibold">
                    {skuMatch} ({knnPercent}%)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleDownloadArtifact}
                  className="text-[11px] text-[#0070BA] font-bold hover:underline inline-flex items-center gap-1"
                >
                  <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                  Download Artifact
                </button>
                <span className="text-[10px] font-mono text-[#78716C]">
                  Hash: {sha256.slice(0, 10)}...
                </span>
              </div>

              {downloadFeedback && (
                <div className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-1.5">
                  {downloadFeedback}
                </div>
              )}
            </>
          ) : (
            <p className="text-[11px] text-[#57534E]">
              Waiting for Merchant to upload and verify Milestone 1 deliverable artifact.
            </p>
          )}

          {/* Real Interactive Buyer Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[#E5E0D8]">
            <button
              type="button"
              disabled={
                !activeMilestone ||
                isCaptured ||
                !isAuthorized ||
                busyAction === 'client-approve'
              }
              onClick={() => activeMilestone && onApproveDeliverable(activeMilestone.id)}
              className="px-2.5 py-2 text-[11px] font-bold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white shadow-subtle transition disabled:opacity-40 flex items-center justify-center gap-1"
              title="Approve deliverable & authorize PayPal capture to Business"
            >
              {busyAction === 'client-approve' ? (
                <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircleIcon className="w-3.5 h-3.5" />
              )}
              <span>{isCaptured ? 'Captured ✓' : 'Approve Deliverable'}</span>
            </button>

            <button
              type="button"
              disabled={!activeMilestone || busyAction === 'client-dispute'}
              onClick={() => activeMilestone && onRaiseDispute(activeMilestone.id)}
              className="px-2.5 py-2 text-[11px] font-bold rounded-lg bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 shadow-subtle transition disabled:opacity-40 flex items-center justify-center gap-1"
              title="Raise a SNAD dispute inquiry directly from Client portal"
            >
              {busyAction === 'client-dispute' ? (
                <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-700" />
              )}
              <span>Raise Dispute Inquiry</span>
            </button>
          </div>
        </div>

        {/* Card 3: Settlement Offer / Capture Receipt */}
        {hasActiveDispute ? (
          <div
            className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
              isDisputeResolved
                ? 'bg-emerald-50 border-emerald-300'
                : 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-[#1C1917] flex items-center gap-1.5">
                <HandThumbUpIcon className="w-4 h-4 text-amber-700" />
                {primaryDispute.dispute_life_cycle_stage === 'CHARGEBACK'
                  ? `Escalated Claim (${primaryDispute.dispute_id})`
                  : `Pre-Escalation Offer (${primaryDispute.dispute_id})`}
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  isDisputeResolved
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }`}
              >
                {primaryDispute.status}
              </span>
            </div>

            <p className="text-[11px] text-[#1C1917] leading-relaxed">
              {isDisputeResolved
                ? `✅ Offer Accepted — $${offerAmount} USD refunded instantly. Inquiry closed at $0 dispute fee; merchant ratio restored to safe tier.`
                : primaryDispute.status === 'UNDER_REVIEW'
                ? `⚖️ Escalated Claim (${primaryDispute.dispute_id}) — Evidence uploaded by merchant; PayPal Adjudication team reviewing.`
                : primaryDispute.status === 'WAITING_FOR_BUYER_RESPONSE'
                ? `🤝 Merchant proposed $${offerAmount} USD instant settlement ($0 dispute fee, immediate credit without chargeback escalation).`
                : primaryDispute.dispute_life_cycle_stage === 'CHARGEBACK'
                ? `🚨 Escalated Chargeback (${primaryDispute.dispute_id}) — Awaiting Merchant multipart evidence (pre-escalation offer locked).`
                : `⏳ Open SNAD Inquiry (${primaryDispute.dispute_id}) — Awaiting Merchant $0-fee settlement offer or evidence.`}
            </p>

            {primaryDispute.status === 'WAITING_FOR_BUYER_RESPONSE' &&
              primaryDispute.dispute_life_cycle_stage !== 'CHARGEBACK' && (
              <button
                type="button"
                disabled={busyAction === 'accept-offer'}
                onClick={() => onAcceptOffer(primaryDispute.dispute_id, offerAmount)}
                className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white shadow-subtle transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {busyAction === 'accept-offer' ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckBadgeIcon className="w-4 h-4" />
                )}
                <span>Accept ${offerAmount} Settlement</span>
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-[#E5E0D8] bg-[#F9F8F5] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#1C1917] flex items-center gap-1.5">
                <CheckBadgeIcon className="w-4 h-4 text-[#0070BA]" />
                Settlement &amp; Dispute Inbox
              </span>
              <span className="text-[10px] font-mono text-[#78716C]">
                {isCaptured ? 'RECEIPT ISSUED' : 'CLEAN'}
              </span>
            </div>
            <p className="text-[11px] text-[#57534E]">
              {isCaptured
                ? `Official Receipt #${activeMilestone?.captureId || 'CAP-88910'} generated ($${activeMilestone?.amount.value || '1250.00'}). No open disputes.`
                : 'No active disputes or settlement offers. Use "Raise Dispute Inquiry" above or Step 4 to test pre-escalation resolution.'}
            </p>
          </div>
        )}
      </div>

      {/* Buyer Protection Guarantee Footer */}
      <div className="pt-2 border-t border-[#E5E0D8] flex items-center justify-between text-[10px] text-[#78716C]">
        <span className="flex items-center gap-1 font-medium">
          <ShieldCheckIcon className="w-3.5 h-3.5 text-[#0070BA]" />
          PayPal Buyer Escrow Protection Active
        </span>
        <span className="font-mono">SOC2 Type II</span>
      </div>
    </div>
  );
};

export default ClientBuyerPortalView;
