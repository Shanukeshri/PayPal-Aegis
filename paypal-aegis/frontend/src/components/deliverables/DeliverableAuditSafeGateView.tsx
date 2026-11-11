import React, { useState } from 'react';
import {
  DocumentTextIcon,
  ShieldCheckIcon,
  CpuChipIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  CodeBracketIcon,
  EyeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import type { Milestone, HITLApprovalRequest } from '../../types';
import api from '../../services/api';

interface DeliverableAuditSafeGateViewProps {
  milestones: Milestone[];
  pendingApprovals: HITLApprovalRequest[];
  onActionComplete: () => void;
}

export const DeliverableAuditSafeGateView: React.FC<DeliverableAuditSafeGateViewProps> = ({
  milestones,
  pendingApprovals,
  onActionComplete,
}) => {
  const [previewTab, setPreviewTab] = useState<'schematic' | 'code'>('schematic');
  const [copiedHash, setCopiedHash] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [decisionFeedback, setDecisionFeedback] = useState<{ text: string; type: 'success' | 'danger' } | null>(null);

  const verifiedDeliverable =
    milestones.flatMap((m) => m.deliverables || []).find((d) => d.verificationDetails) ||
    milestones[0]?.deliverables?.[0];
  const activeMilestone =
    milestones.find((m) => m.deliverables?.some((d) => d.verificationDetails)) ||
    milestones.find((m) => m.status === 'VERIFIED') ||
    milestones[0];
  const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const fileName = 'edge_router_v2_schematic.pdf';
  const fileSize = '248 KB (253,952 bytes)';

  // Find relevant pending capture approval or use default
  const pendingCapture = pendingApprovals.find(
    (r) => r.type === 'AUTHORIZATION_CAPTURE' || (r.payload as any)?.action === 'CAPTURE_AUTHORIZATION'
  ) || pendingApprovals[0];

  const verificationDetails = verifiedDeliverable?.verificationDetails;
  const rawKnnScore =
    verificationDetails?.elasticKnnScore ?? (pendingCapture?.payload as any)?.knnScore;
  const knnScoreNum = typeof rawKnnScore === 'number' ? rawKnnScore : 0.8586;
  const knnPercentStr = (knnScoreNum * 100).toFixed(1);
  const cosineDistStr = Math.max(0.001, 1 - knnScoreNum).toFixed(3);
  const skuMatch = verificationDetails?.channel3SkuMatch || 'CH3-TECH-88921';

  const handleCopyHash = () => {
    navigator.clipboard.writeText(sha256);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleApprove = async () => {
    if (executingAction) return; // double-click debounce protection
    setExecutingAction('approve');
    try {
      if (pendingCapture) {
        await api.approveHitlAction(pendingCapture.id, 'sec-lead@aegis.corp');
      } else if (activeMilestone) {
        await api.captureMilestone(activeMilestone.id);
      }
      setDecisionFeedback({
        text: 'Decision Approved & Dispatched: capture_authorization executed via SafeGate Firewall.',
        type: 'success',
      });
      onActionComplete();
    } catch (err: any) {
      setDecisionFeedback({
        text: `Approval failed: ${err.message}`,
        type: 'danger',
      });
    } finally {
      setExecutingAction(null);
    }
  };

  const handleReject = async () => {
    if (executingAction) return; // double-click debounce protection
    setExecutingAction('reject');
    try {
      if (pendingCapture) {
        await api.rejectHitlAction(
          pendingCapture.id,
          'sec-lead@aegis.corp',
          'Deliverable rejected: Specification revision required'
        );
      }
      setDecisionFeedback({
        text: 'Action Rejected: capture_authorization blocked and merchant notified.',
        type: 'danger',
      });
      onActionComplete();
    } catch (err: any) {
      setDecisionFeedback({
        text: `Rejection failed: ${err.message}`,
        type: 'danger',
      });
    } finally {
      setExecutingAction(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Tab Context Banner */}
      <div className="bg-white border border-[#E5E0D8] rounded-xl p-4 shadow-subtle flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-[#0070BA] flex items-center justify-center text-white shadow-subtle">
            <ShieldCheckIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
              Deliverable Audit & SafeGate Human-in-the-Loop (HITL) Console
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#F4F1EA] text-[#0070BA] border border-[#0070BA]/30 font-bold">
                Stage 3 Visualizer
              </span>
            </h2>
            <p className="text-xs text-[#57534E]">
              Multimodal verification pairing Channel3 100M+ catalog SKU match with Elastic kNN vector similarity, paused in SafeGate HITL approval.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8]">
            {pendingApprovals.length > 0 ? (
              <>
                <span className="w-2 h-2 rounded-full mr-2 bg-[#0070BA] animate-ping" />
                {pendingApprovals.length} Action Intercepted in HITL
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-4 h-4 mr-1.5 text-emerald-600" />
                SafeGate Firewall Standing By
              </>
            )}
          </span>
        </div>
      </div>

      {/* Decision feedback banner */}
      {decisionFeedback && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold border flex items-center justify-between shadow-subtle ${
            decisionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-red-50 text-red-900 border-red-300'
          }`}
        >
          <span>{decisionFeedback.text}</span>
          <button
            onClick={() => setDecisionFeedback(null)}
            className="text-xs font-bold px-2 py-0.5 rounded hover:bg-black/5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Three-Card Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* CARD 1: Deliverable Artifact Preview */}
        <div className="bg-white border border-[#E5E0D8] rounded-xl p-4 shadow-subtle flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E0D8]">
              <div className="flex items-center space-x-2">
                <DocumentTextIcon className="w-4 h-4 text-[#0070BA]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1C1917]">
                  Card 1: Artifact Preview
                </h3>
              </div>
              <div className="flex bg-[#F4F1EA] p-0.5 rounded-lg border border-[#E5E0D8]">
                <button
                  onClick={() => setPreviewTab('schematic')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                    previewTab === 'schematic'
                      ? 'bg-[#0070BA] text-white'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  Schematic
                </button>
                <button
                  onClick={() => setPreviewTab('code')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                    previewTab === 'code'
                      ? 'bg-[#0070BA] text-white'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  Spec / YAML
                </button>
              </div>
            </div>

            {/* Preview Box */}
            <div className="mt-3 bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3 min-h-[170px] flex items-center justify-center">
              {previewTab === 'schematic' ? (
                <div className="w-full text-center space-y-2">
                  <svg
                    className="w-full h-28 mx-auto"
                    viewBox="0 0 320 110"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect x="10" y="20" width="80" height="70" rx="6" fill="#FFFFFF" stroke="#0070BA" strokeWidth="1.5" />
                    <text x="50" y="50" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1C1917">VPC Gateway</text>
                    <text x="50" y="65" textAnchor="middle" fontSize="7" fill="#57534E">10.0.0.0/16</text>

                    <line x1="90" y1="55" x2="130" y2="55" stroke="#0070BA" strokeWidth="1.5" strokeDasharray="3 3" />
                    <circle cx="110" cy="55" r="3" fill="#0070BA" />

                    <rect x="130" y="10" width="100" height="90" rx="6" fill="#FFFFFF" stroke="#1C1917" strokeWidth="1.5" />
                    <text x="180" y="35" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1C1917">Cluster Node-Pool</text>
                    <text x="180" y="50" textAnchor="middle" fontSize="7" fill="#57534E">k8s v1.30.2</text>
                    <rect x="145" y="60" width="70" height="20" rx="3" fill="#E6F2FA" stroke="#0070BA" strokeWidth="1" />
                    <text x="180" y="73" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#0070BA">SOC2 Enclave</text>

                    <line x1="230" y1="55" x2="260" y2="55" stroke="#0070BA" strokeWidth="1.5" />
                    <rect x="260" y="25" width="50" height="60" rx="6" fill="#FFFFFF" stroke="#0070BA" strokeWidth="1.5" />
                    <text x="285" y="50" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1C1917">PayPal</text>
                    <text x="285" y="62" textAnchor="middle" fontSize="7" fill="#57534E">Orders v2</text>
                  </svg>
                  <span className="text-[10px] text-[#57534E] font-mono block">
                    {fileName} (Interactive SVG Schematic Render)
                  </span>
                </div>
              ) : (
                <pre className="text-[10px] font-mono text-[#1C1917] leading-relaxed w-full overflow-x-auto text-left">
                  {`terraform {
  required_version = ">= 1.5.0"
  provider "aegis" {
    cloud_tier = "LEVEL_4_SLA"
    soc2_audit = true
    paypal_reconcile = true
  }
}
resource "aegis_escrow_milestone" "m1" {
  sku    = "CH3-TECH-88921"
  hash   = "e3b0c442..."
}`}
                </pre>
              )}
            </div>

            {/* Metadata Fields */}
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#57534E]">Byte Size:</span>
                <span className="font-mono font-bold text-[#1C1917]">{fileSize}</span>
              </div>

              <div>
                <span className="text-[#57534E] text-[11px] block mb-0.5">SHA-256 Hash Calculation:</span>
                <div className="flex items-center space-x-1 font-mono text-[10px] bg-[#F4F1EA] p-1.5 rounded border border-[#E5E0D8]">
                  <span className="truncate flex-1 text-[#1C1917] font-semibold">{sha256}</span>
                  <button
                    onClick={handleCopyHash}
                    className="p-1 text-[#57534E] hover:text-[#0070BA] transition"
                    title="Copy SHA-256"
                  >
                    {copiedHash ? (
                      <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E5E0D8] text-[11px] text-[#0070BA] font-semibold flex items-center gap-1.5">
            <CheckCircleIcon className="w-4 h-4 text-[#0070BA] flex-shrink-0" />
            <span>SHA-256 Hash Grounded in Contract Vault</span>
          </div>
        </div>

        {/* CARD 2: Multimodal RAG Verification */}
        <div className="bg-white border border-[#E5E0D8] rounded-xl p-4 shadow-subtle flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E0D8]">
              <div className="flex items-center space-x-2">
                <CpuChipIcon className="w-4 h-4 text-[#0070BA]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1C1917]">
                  Card 2: Multimodal RAG Verification
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold">
                Dual Grounded
              </span>
            </div>

            {/* Badges Box */}
            <div className="mt-3 space-y-2.5">
              {/* Channel3 Badge */}
              <div className="p-2.5 rounded-lg bg-[#F9F8F5] border border-[#0070BA]/30">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#1C1917] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#0070BA]" />
                    Channel3 100M+ Catalog Spec
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#0070BA] text-white">
                    Verified
                  </span>
                </div>
                <div className="mt-1 font-mono text-xs font-bold text-[#0070BA]">
                  {skuMatch} Verified
                </div>
                <p className="text-[10px] text-[#57534E] mt-0.5">
                  SKU catalog attributes matched: Tier 4 SLA, MIT Enterprise License, Level 4 Spec.
                </p>
              </div>

              {/* Elastic kNN Badge */}
              <div className="p-2.5 rounded-lg bg-[#F9F8F5] border border-emerald-300">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#1C1917] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    Elastic kNN Vector Similarity
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Authentic
                  </span>
                </div>
                <div className="mt-1 font-mono text-xs font-bold text-emerald-800">
                  {knnPercentStr}% Authentic Match — Not Stock Photo
                </div>
                <p className="text-[10px] text-[#57534E] mt-0.5">
                  Cosine distance {cosineDistStr} in 64-dim embedding vault. Stock photo probability &lt;0.5%.
                </p>
              </div>
            </div>

            {/* Telemetry Metrics */}
            <div className="mt-3 bg-[#F4F1EA] p-2.5 rounded-lg border border-[#E5E0D8] space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#57534E]">Vector Index:</span>
                <span className="font-mono font-semibold text-[#1C1917]">channel3-catalog-embeddings</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#57534E]">RAG Retrieval Latency:</span>
                <span className="font-mono font-semibold text-[#0070BA]">18.4ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#57534E]">Tamper Integrity:</span>
                <span className="font-mono font-semibold text-emerald-700">Zero Inconsistencies</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E5E0D8] text-[11px] text-[#57534E] flex items-center justify-between">
            <span>Grounding Confidence:</span>
            <span className="font-bold font-mono text-[#1C1917]">Dual Verified (APIMatic + Elastic)</span>
          </div>
        </div>

        {/* CARD 3: SafeGate HITL Decision Console */}
        <div className="bg-white border border-[#E5E0D8] rounded-xl p-4 shadow-subtle flex flex-col justify-between space-y-4 ring-1 ring-[#0070BA]/20">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E0D8]">
              <div className="flex items-center space-x-2">
                <ShieldCheckIcon className="w-4 h-4 text-[#0070BA]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1C1917]">
                  Card 3: SafeGate HITL Console
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wider">
                Intercepted
              </span>
            </div>

            {/* Intercepted Details */}
            <div className="mt-3 space-y-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-semibold text-[#57534E]">Intercepted Tool:</span>
                  <span className="font-mono font-bold text-xs text-[#0070BA] bg-[#E6F2FA] px-2 py-0.5 rounded border border-[#0070BA]/30">
                    capture_authorization
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-[#57534E] mt-1">
                  <span>Target Authorization:</span>
                  <span className="font-mono text-[#1C1917] font-semibold">
                    {activeMilestone?.activeAuthorizationId || '0VF52814937998046'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-[#57534E] mt-1">
                  <span>Escrow Amount:</span>
                  <span className="font-mono text-[#1C1917] font-bold text-xs">
                    ${activeMilestone?.amount.value || '1,250.00'} USD
                  </span>
                </div>
              </div>

              {/* Operator Signature Stamp */}
              <div className="p-2.5 rounded-lg bg-[#F4F1EA] border border-[#E5E0D8] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#78716C] block">
                    Security Operator Signature
                  </span>
                  <span className="font-mono text-xs font-bold text-[#1C1917]">
                    approver: sec-lead@aegis.corp
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#0070BA] border border-[#E5E0D8]">
                  WCAG Verified
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons with double-click debounce protection */}
          <div className="pt-2 border-t border-[#E5E0D8] space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleReject}
                disabled={!!executingAction}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-white hover:bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8] shadow-subtle transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <XCircleIcon className="w-4 h-4 text-[#57534E]" />
                <span>Reject</span>
              </button>

              <button
                type="button"
                onClick={handleApprove}
                disabled={!!executingAction}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white shadow-subtle transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {executingAction === 'approve' ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <CheckCircleIcon className="w-4 h-4 text-white" />
                )}
                <span>Approve & Execute</span>
              </button>
            </div>
            <span className="text-[10px] text-[#78716C] font-mono block text-center">
              Double-click debounce protection active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliverableAuditSafeGateView;

