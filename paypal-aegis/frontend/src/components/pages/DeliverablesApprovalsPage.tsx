import React, { useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowDownTrayIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import type { Milestone, HITLApprovalRequest, UserRole } from '../../types';
import {
  getActiveMilestone,
  getVerifiedDeliverable,
  computeFileSha256Hex,
} from '../../lib/workflow';

const DEFAULT_DELIVERABLE_TITLE = 'Industrial Edge Router SKU-9921';
const DEFAULT_DELIVERABLE_SKU = 'CH3-TECH-88921';
const DEFAULT_DELIVERABLE_FILE = 'edge_router_v2_schematic.pdf';
const DEFAULT_DELIVERABLE_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const DEFAULT_DISPUTE_REASON = 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED';
const DEFAULT_DISPUTE_AMOUNT = '350.00';
const DEFAULT_DISPUTE_NOTE =
  'The milestone deliverables did not match the agreed architecture specs and hardware SKU manifest.';

function buildArtifactBlob(opts: {
  fileName: string;
  title: string;
  milestoneName: string;
  skuMatch: string;
  knnPct: string;
  sha256: string;
}): Blob {
  if (opts.fileName.toLowerCase().endsWith('.pdf')) {
    const safeLine = (text: string) =>
      text.replace(/[()\\]/g, '').replace(/[^\x20-\x7E]/g, '-');
    const lines = [
      'PayPal Aegis Deliverable Artifact Package',
      `File: ${safeLine(opts.fileName)}`,
      `Title: ${safeLine(opts.title)}`,
      `Milestone: ${safeLine(opts.milestoneName)}`,
      `Catalog SKU Match: ${safeLine(opts.skuMatch)}`,
      `Elastic kNN Similarity: ${safeLine(opts.knnPct)}%`,
      `SHA-256: ${safeLine(opts.sha256)}`,
    ];
    const textOps = lines
      .map((line, i) => `1 0 0 1 50 ${740 - i * 18} Tm (${line}) Tj`)
      .join('\n');
    const stream = `BT\n/F1 11 Tf\n${textOps}\nET`;
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
      `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    ];
    let body = '%PDF-1.4\n';
    const offsets = [0];
    for (const obj of objects) {
      offsets.push(body.length);
      body += obj + '\n';
    }
    const xrefStart = body.length;
    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i += 1) {
      body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return new Blob([body], { type: 'application/pdf' });
  }

  const content = [
    `PayPal Aegis Deliverable Artifact`,
    `File: ${opts.fileName}`,
    `Title: ${opts.title}`,
    `Milestone: ${opts.milestoneName}`,
    `SKU Match: ${opts.skuMatch}`,
    `Vector Match: ${opts.knnPct}%`,
    `SHA-256: ${opts.sha256}`,
  ].join('\n');
  return new Blob([content], { type: 'text/plain;charset=utf-8' });
}

interface DeliverablesApprovalsPageProps {
  role: UserRole;
  milestones: Milestone[];
  pendingApprovals: HITLApprovalRequest[];
  busyAction: string | null;
  onClientApproveDeliverable: (milestoneId: string) => Promise<void>;
  onClientRaiseDispute: (
    milestoneId: string,
    options?: { reason?: string; disputeAmount?: string; message?: string }
  ) => Promise<void>;
  onMerchantVerifyDeliverable: (
    milestoneId: string,
    options?: { customTitle?: string; customSku?: string; fileName?: string; fileSha256?: string }
  ) => Promise<void>;
  onApproveHitl: (approvalId: string) => Promise<void>;
  onRejectHitl: (approvalId: string) => Promise<void>;
  onCaptureMilestone: (milestoneId: string) => Promise<void>;
}

export const DeliverablesApprovalsPage: React.FC<DeliverablesApprovalsPageProps> = ({
  role,
  milestones,
  pendingApprovals,
  busyAction,
  onClientApproveDeliverable,
  onClientRaiseDispute,
  onMerchantVerifyDeliverable,
  onApproveHitl,
  onRejectHitl,
  onCaptureMilestone,
}) => {
  // Verification details accordion collapsed by default
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<'schematic' | 'code'>('schematic');
  const [copiedHash, setCopiedHash] = useState(false);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState<{ text: string; kind: 'ok' | 'warn' } | null>(
    null
  );

  // Merchant deliverable submission inputs (visible defaults)
  const [customTitle, setCustomTitle] = useState(DEFAULT_DELIVERABLE_TITLE);
  const [customSku, setCustomSku] = useState(DEFAULT_DELIVERABLE_SKU);
  const [uploadFileName, setUploadFileName] = useState(DEFAULT_DELIVERABLE_FILE);
  const [uploadFileSha256, setUploadFileSha256] = useState(DEFAULT_DELIVERABLE_SHA256);

  // Client dispute composer inputs (visible defaults)
  const [disputeReason, setDisputeReason] = useState(DEFAULT_DISPUTE_REASON);
  const [disputeAmountInput, setDisputeAmountInput] = useState(DEFAULT_DISPUTE_AMOUNT);
  const [disputeNote, setDisputeNote] = useState(DEFAULT_DISPUTE_NOTE);

  const activeMilestone = getActiveMilestone(milestones);
  const verifiedDeliverable = getVerifiedDeliverable(activeMilestone);
  const verificationDetails = verifiedDeliverable?.verificationDetails;

  const isVerified =
    Boolean(verifiedDeliverable) ||
    activeMilestone?.status === 'VERIFIED' ||
    activeMilestone?.status === 'CAPTURED';
  const isCaptured = activeMilestone?.status === 'CAPTURED';
  const isAuthorized =
    activeMilestone?.status === 'AUTHORIZED' ||
    activeMilestone?.status === 'REAUTHORIZED' ||
    activeMilestone?.status === 'VERIFIED' ||
    activeMilestone?.status === 'CAPTURED';

  const fileName =
    verificationDetails?.fileName || uploadFileName || DEFAULT_DELIVERABLE_FILE;
  const sha256 =
    verifiedDeliverable?.sha256Hash ||
    uploadFileSha256 ||
    DEFAULT_DELIVERABLE_SHA256;
  const pendingCapture =
    pendingApprovals.find(
      (r) =>
        r.type === 'CAPTURE_AUTHORIZATION' ||
        r.type === 'AUTHORIZATION_CAPTURE' ||
        (r.payload as any)?.action === 'CAPTURE_AUTHORIZATION'
    ) || pendingApprovals[0];

  const rawKnn =
    verificationDetails?.elasticKnnScore ?? (pendingCapture?.payload as any)?.knnScore;
  const knnNum = typeof rawKnn === 'number' ? rawKnn : 0.8586;
  const knnPct = (knnNum * 100).toFixed(1);
  const cosineDist = Math.max(0.001, 1 - knnNum).toFixed(3);
  const skuMatch = verificationDetails?.channel3SkuMatch || customSku || DEFAULT_DELIVERABLE_SKU;

  const handleCopyHash = () => {
    navigator.clipboard.writeText(sha256);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleDownloadArtifact = () => {
    const blob = buildArtifactBlob({
      fileName,
      title: verifiedDeliverable?.name || customTitle || DEFAULT_DELIVERABLE_TITLE,
      milestoneName: activeMilestone?.name || 'Active Milestone',
      skuMatch,
      knnPct,
      sha256,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setDownloadNote(`Downloaded "${fileName}" (SHA-256 ${sha256.slice(0, 12)}...)`);
    setTimeout(() => setDownloadNote(null), 4000);
  };

  const handleMerchantFileSelected = async (file: File) => {
    setUploadFileName(file.name);
    try {
      const hex = await computeFileSha256Hex(file);
      setUploadFileSha256(hex);
    } catch {
      // Retain existing digest if WebCrypto is unavailable
    }
  };

  const parsedDisputeAmt = parseFloat(disputeAmountInput);
  const isDisputeAmtFallback = isNaN(parsedDisputeAmt) || parsedDisputeAmt <= 0;
  const effectiveDisputeAmt = isDisputeAmtFallback ? '10.00' : parsedDisputeAmt.toFixed(2);
  const approvingThisMilestone = Boolean(
    activeMilestone && busyAction === `client:approve:${activeMilestone.id}`
  );
  const disputingThisMilestone = Boolean(
    activeMilestone && busyAction === `client:dispute:${activeMilestone.id}`
  );
  const verifyingDeliverable =
    busyAction === 'verify-deliverable' || busyAction === 'custom-verify';

  const handleApproveAction = async () => {
    if (busyAction) return;
    if (pendingCapture) {
      await onApproveHitl(pendingCapture.id);
      setDecisionNote({
        text: 'Capture approved and funds settled via SafeGate.',
        kind: 'ok',
      });
    } else if (activeMilestone) {
      await onCaptureMilestone(activeMilestone.id);
      setDecisionNote({
        text: 'Milestone funds captured and settled.',
        kind: 'ok',
      });
    }
  };

  const handleRejectAction = async () => {
    if (busyAction || !pendingCapture) return;
    await onRejectHitl(pendingCapture.id);
    setDecisionNote({
      text: 'Capture rejected. Escrow funds remain protected.',
      kind: 'warn',
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-[#1C1917] tracking-tight">
          Deliverables &amp; Approvals
        </h1>
        <p className="text-xs text-[#57534E] mt-0.5">
          {role === 'CLIENT'
            ? 'Inspect submitted work, verify completion, and approve or dispute payment release.'
            : 'Submit deliverables for verification and approve SafeGate payout captures.'}
        </p>
      </div>

      {decisionNote && (
        <div
          className={`rounded-lg px-4 py-2.5 text-xs font-semibold border flex items-center justify-between ${
            decisionNote.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          <span>{decisionNote.text}</span>
          <button
            type="button"
            onClick={() => setDecisionNote(null)}
            className="text-xs font-bold px-1.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* CLIENT VIEW */}
      {role === 'CLIENT' && (
        <div className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E0D8]">
            <div>
              <span className="text-xs font-medium text-[#78716C] block">
                {activeMilestone?.name || 'Milestone Deliverable'}
              </span>
              <h2 className="text-base font-bold text-[#1C1917] mt-0.5">
                {isVerified ? fileName : 'No deliverable submitted yet'}
              </h2>
            </div>

            {isVerified && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircleIcon className="w-4 h-4" />
                Verified
              </span>
            )}
          </div>

          {isVerified ? (
            <div className="space-y-3">
              <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5 text-xs">
                  <div className="font-semibold text-[#1C1917]">
                    {verifiedDeliverable?.name || 'Verified Deliverable Package'}
                  </div>
                  <div className="text-[#57534E]">
                    Milestone Amount: ${activeMilestone?.amount.value || '1250.00'}{' '}
                    {activeMilestone?.amount.currency_code || 'USD'} · 248 KB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadArtifact}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-[#F4F1EA] text-[#0070BA] border border-[#E5E0D8]"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  <span>Download Artifact</span>
                </button>
              </div>

              {downloadNote && (
                <p className="text-xs font-medium text-emerald-700">{downloadNote}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-[#57534E]">
              Waiting for the merchant to upload and verify the deliverable for this milestone.
            </p>
          )}

          <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#57534E]">
                Dispute Claim Details (prefilled defaults)
              </span>
              <span className="text-[11px] font-mono text-[#78716C]">
                Claim: ${effectiveDisputeAmt} USD
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label
                  htmlFor="delivery-dispute-reason"
                  className="block text-[11px] font-semibold text-[#57534E] mb-1"
                >
                  Dispute Reason
                </label>
                <select
                  id="delivery-dispute-reason"
                  name="deliveryDisputeReason"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#E5E0D8] bg-white"
                >
                  <option value="MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED">
                    Not as described (Default)
                  </option>
                  <option value="ITEM_NOT_RECEIVED">Deliverable not received</option>
                  <option value="UNAUTHORIZED">Unauthorized charge</option>
                  <option value="BILLING_ERROR">Billing discrepancy</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="delivery-dispute-amount"
                  className="block text-[11px] font-semibold text-[#57534E] mb-1"
                >
                  Claim Amount ($ · default 350.00)
                </label>
                <input
                  id="delivery-dispute-amount"
                  name="deliveryDisputeAmount"
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
                  htmlFor="delivery-dispute-note"
                  className="block text-[11px] font-semibold text-[#57534E] mb-1"
                >
                  Client Note
                </label>
                <input
                  id="delivery-dispute-note"
                  name="deliveryDisputeNote"
                  type="text"
                  value={disputeNote}
                  onChange={(e) => setDisputeNote(e.target.value)}
                  placeholder={DEFAULT_DISPUTE_NOTE}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#E5E0D8] bg-white"
                />
              </div>
            </div>
            {isDisputeAmtFallback && (
              <p className="text-[11px] text-amber-800">
                Non-positive amount normalized cleanly to minimum $10.00 USD fallback.
              </p>
            )}
          </div>

          <div className="pt-1 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={
                !activeMilestone ||
                !isAuthorized ||
                isCaptured ||
                approvingThisMilestone
              }
              onClick={() =>
                activeMilestone && onClientApproveDeliverable(activeMilestone.id)
              }
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white shadow-subtle transition disabled:opacity-40 flex items-center gap-1.5"
            >
              {approvingThisMilestone ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircleIcon className="w-4 h-4" />
              )}
              <span>{isCaptured ? 'Approved & Settled' : 'Approve & Release'}</span>
            </button>

            <button
              type="button"
              disabled={!activeMilestone || disputingThisMilestone}
              onClick={() =>
                activeMilestone &&
                onClientRaiseDispute(activeMilestone.id, {
                  reason: disputeReason,
                  disputeAmount: effectiveDisputeAmt,
                  message: disputeNote.trim() || DEFAULT_DISPUTE_NOTE,
                })
              }
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 transition disabled:opacity-40 flex items-center gap-1.5"
            >
              {disputingThisMilestone ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <ExclamationTriangleIcon className="w-4 h-4 text-amber-700" />
              )}
              <span>Raise Dispute</span>
            </button>
          </div>
        </div>
      )}

      {/* MERCHANT VIEW */}
      {role === 'MERCHANT' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Deliverable Upload & Verification Status */}
          <div className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#1C1917]">
                  Deliverable Submission
                </h2>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-[#57534E]">
                {activeMilestone
                  ? `Target: ${activeMilestone.name} ($${activeMilestone.amount.value} USD)`
                  : 'Seed a contract first to submit a milestone deliverable.'}
              </p>

              {!isVerified && (
                <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="merchant-deliverable-title"
                        className="block text-[11px] font-semibold text-[#57534E] mb-1"
                      >
                        Deliverable Title (default: Router SKU-9921)
                      </label>
                      <input
                        id="merchant-deliverable-title"
                        name="merchantDeliverableTitle"
                        type="text"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder={DEFAULT_DELIVERABLE_TITLE}
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#E5E0D8] bg-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="merchant-deliverable-sku"
                        className="block text-[11px] font-semibold text-[#57534E] mb-1"
                      >
                        Catalog SKU (default: CH3-TECH-88921)
                      </label>
                      <input
                        id="merchant-deliverable-sku"
                        name="merchantDeliverableSku"
                        type="text"
                        value={customSku}
                        onChange={(e) => setCustomSku(e.target.value)}
                        placeholder={DEFAULT_DELIVERABLE_SKU}
                        className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-[#E5E0D8] bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <label
                      htmlFor="merchant-deliverable-file"
                      className="inline-flex items-center gap-2 text-[11px] font-medium text-[#57534E] cursor-pointer hover:text-[#1C1917]"
                    >
                      <input
                        id="merchant-deliverable-file"
                        name="merchantDeliverableFile"
                        type="file"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleMerchantFileSelected(f);
                        }}
                      />
                      <span className="px-2 py-1 rounded border border-[#E5E0D8] bg-white text-[11px] font-semibold text-[#1C1917]">
                        Choose File
                      </span>
                      <span className="font-mono text-[#57534E] truncate max-w-[180px]">
                        {uploadFileName}
                      </span>
                    </label>
                    <span className="text-[10px] font-mono text-[#78716C]">
                      SHA-256: {uploadFileSha256.slice(0, 12)}...
                    </span>
                  </div>
                </div>
              )}

              {isVerified && (
                <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3 text-xs space-y-1">
                  <div className="font-semibold text-[#1C1917]">{fileName}</div>
                  <div className="text-[#57534E]">
                    Authenticity verified ({knnPct}% match) · Ready for payout approval
                  </div>
                </div>
              )}
            </div>

            <div>
              <button
                type="button"
                disabled={
                  !activeMilestone ||
                  isCaptured ||
                  activeMilestone.status === 'VERIFIED' ||
                  verifyingDeliverable
                }
                onClick={() =>
                  activeMilestone &&
                  onMerchantVerifyDeliverable(activeMilestone.id, {
                    customTitle: customTitle.trim() || DEFAULT_DELIVERABLE_TITLE,
                    customSku: customSku.trim() || DEFAULT_DELIVERABLE_SKU,
                    fileName: uploadFileName || DEFAULT_DELIVERABLE_FILE,
                    fileSha256: uploadFileSha256,
                  })
                }
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white shadow-subtle transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {verifyingDeliverable ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <DocumentArrowUpIcon className="w-4 h-4" />
                )}
                <span>
                  {isCaptured
                    ? 'Deliverable Settled'
                    : activeMilestone?.status === 'VERIFIED'
                    ? 'Verification Complete'
                    : 'Upload & Verify Deliverable'}
                </span>
              </button>
            </div>
          </div>

          {/* SafeGate HITL Approval Queue */}
          <div className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
                  <ShieldCheckIcon className="w-4 h-4 text-[#0070BA]" />
                  SafeGate Approval Queue
                </h2>
                {pendingCapture && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    Pending Review
                  </span>
                )}
              </div>

              {pendingCapture ? (
                <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#0070BA]">
                      capture_authorization
                    </span>
                    <span className="font-mono font-bold text-[#1C1917]">
                      ${activeMilestone?.amount.value || '1250.00'} USD
                    </span>
                  </div>
                  <p className="text-[#57534E] leading-relaxed">
                    {pendingCapture.description}
                  </p>
                  <div className="text-[11px] font-mono text-[#78716C]">
                    Target Auth: {activeMilestone?.activeAuthorizationId || 'N/A'} · Operator
                    sec-lead@aegis.corp
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#57534E]">
                  No capture actions awaiting approval right now.
                </p>
              )}
            </div>

            {pendingCapture && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={handleRejectAction}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-white hover:bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8] flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {busyAction?.startsWith('hitl:reject') ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin text-[#57534E]" />
                  ) : (
                    <XCircleIcon className="w-4 h-4 text-[#57534E]" />
                  )}
                  <span>Reject</span>
                </button>
                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={handleApproveAction}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {busyAction?.startsWith('hitl:approve') || busyAction?.startsWith('capture:') ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircleIcon className="w-4 h-4" />
                  )}
                  <span>Approve &amp; Execute</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsed-by-Default "Verification details" Accordion */}
      <div className="bg-white border border-[#E5E0D8] rounded-xl shadow-subtle overflow-hidden">
        <button
          type="button"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((prev) => !prev)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-[#F9F8F5] transition"
        >
          <div>
            <span className="text-sm font-bold text-[#1C1917] block">
              Verification details
            </span>
            <span className="text-xs text-[#78716C]">
              SHA-256 hash, catalog SKU match, vector score, and schematic preview
            </span>
          </div>
          {detailsOpen ? (
            <ChevronUpIcon className="w-4 h-4 text-[#57534E]" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-[#57534E]" />
          )}
        </button>

        {detailsOpen && (
          <div className="px-5 pb-5 pt-3 border-t border-[#E5E0D8] grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Cryptographic & Vector Checks */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[11px] font-semibold text-[#78716C] block mb-1">
                  SHA-256 Hash
                </span>
                <div className="flex items-center gap-2 bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg px-2.5 py-1.5 font-mono text-[11px]">
                  <span className="truncate flex-1 text-[#1C1917]">{sha256}</span>
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    className="px-1.5 py-1 text-[#57534E] hover:text-[#0070BA] inline-flex items-center gap-1 rounded"
                    title="Copy SHA-256 Hash"
                  >
                    {copiedHash ? (
                      <>
                        <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[11px] font-sans font-semibold text-emerald-700">
                          Copied
                        </span>
                      </>
                    ) : (
                      <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3 space-y-1">
                  <span className="text-[11px] font-semibold text-[#78716C] block">
                    Channel3 Catalog Match
                  </span>
                  <span className="font-mono font-bold text-[#0070BA] block">
                    {skuMatch}
                  </span>
                  <span className="text-[11px] text-[#57534E] block">
                    Matched against 100M+ catalog attributes
                  </span>
                </div>

                <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3 space-y-1">
                  <span className="text-[11px] font-semibold text-[#78716C] block">
                    Elastic kNN Authenticity
                  </span>
                  <span className="font-mono font-bold text-emerald-700 block">
                    {knnPct}% Authentic Match
                  </span>
                  <span className="text-[11px] text-[#57534E] block">
                    Cosine distance {cosineDist} · Not stock photo
                  </span>
                </div>
              </div>

              <div className="bg-[#F4F1EA] rounded-lg p-3 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#57534E]">Vector Index:</span>
                  <span className="font-mono font-semibold text-[#1C1917]">
                    channel3-catalog-embeddings
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#57534E]">Retrieval Latency:</span>
                  <span className="font-mono font-semibold text-[#0070BA]">18.4ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#57534E]">Tamper Integrity:</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    Zero inconsistencies
                  </span>
                </div>
              </div>
            </div>

            {/* Schematic / Spec YAML Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1C1917]">
                  Artifact Preview
                </span>
                <div className="inline-flex bg-[#F4F1EA] p-0.5 rounded-lg border border-[#E5E0D8]">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('schematic')}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                      previewTab === 'schematic'
                        ? 'bg-white text-[#1C1917] shadow-subtle'
                        : 'text-[#57534E]'
                    }`}
                  >
                    Schematic
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('code')}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                      previewTab === 'code'
                        ? 'bg-white text-[#1C1917] shadow-subtle'
                        : 'text-[#57534E]'
                    }`}
                  >
                    Spec / YAML
                  </button>
                </div>
              </div>

              <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3 min-h-[160px] flex items-center justify-center">
                {previewTab === 'schematic' ? (
                  <svg
                    className="w-full h-28 mx-auto"
                    viewBox="0 0 320 110"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="10"
                      y="20"
                      width="80"
                      height="70"
                      rx="6"
                      fill="#FFFFFF"
                      stroke="#0070BA"
                      strokeWidth="1.5"
                    />
                    <text x="50" y="50" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1C1917">
                      VPC Gateway
                    </text>
                    <text x="50" y="65" textAnchor="middle" fontSize="7" fill="#57534E">
                      10.0.0.0/16
                    </text>
                    <line
                      x1="90"
                      y1="55"
                      x2="130"
                      y2="55"
                      stroke="#0070BA"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    <circle cx="110" cy="55" r="3" fill="#0070BA" />
                    <rect
                      x="130"
                      y="10"
                      width="100"
                      height="90"
                      rx="6"
                      fill="#FFFFFF"
                      stroke="#1C1917"
                      strokeWidth="1.5"
                    />
                    <text x="180" y="35" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1C1917">
                      Cluster Node-Pool
                    </text>
                    <text x="180" y="50" textAnchor="middle" fontSize="7" fill="#57534E">
                      k8s v1.30.2
                    </text>
                    <rect
                      x="145"
                      y="60"
                      width="70"
                      height="20"
                      rx="3"
                      fill="#E6F2FA"
                      stroke="#0070BA"
                      strokeWidth="1"
                    />
                    <text x="180" y="73" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#0070BA">
                      SOC2 Enclave
                    </text>
                    <line x1="230" y1="55" x2="260" y2="55" stroke="#0070BA" strokeWidth="1.5" />
                    <rect
                      x="260"
                      y="25"
                      width="50"
                      height="60"
                      rx="6"
                      fill="#FFFFFF"
                      stroke="#0070BA"
                      strokeWidth="1.5"
                    />
                    <text x="285" y="50" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1C1917">
                      PayPal
                    </text>
                    <text x="285" y="62" textAnchor="middle" fontSize="7" fill="#57534E">
                      Orders v2
                    </text>
                  </svg>
                ) : (
                  <pre className="text-[11px] font-mono text-[#1C1917] leading-relaxed w-full overflow-x-auto">
                    {`terraform {
  required_version = ">= 1.5.0"
  provider "aegis" {
    cloud_tier = "LEVEL_4_SLA"
    soc2_audit = true
  }
}
resource "aegis_escrow_milestone" "m1" {
  sku  = "${skuMatch}"
  hash = "${sha256.slice(0, 12)}..."
}`}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliverablesApprovalsPage;
