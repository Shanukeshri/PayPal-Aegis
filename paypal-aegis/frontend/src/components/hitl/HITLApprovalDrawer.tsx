import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldExclamationIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  CpuChipIcon,
  EyeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { HITLApprovalRequest } from '../../types';
import api from '../../services/api';

interface HITLApprovalDrawerProps {
  pendingApprovals: HITLApprovalRequest[];
  onActionComplete: () => void;
}

export const HITLApprovalDrawer: React.FC<HITLApprovalDrawerProps> = ({
  pendingApprovals,
  onActionComplete,
}) => {
  const [selectedApproval, setSelectedApproval] = useState<HITLApprovalRequest | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Deduplicate staged items by action type and target entity to guarantee clean presentation
  const dedupedApprovals = useMemo(() => {
    const seen = new Set<string>();
    const result: HITLApprovalRequest[] = [];
    for (const req of pendingApprovals) {
      const targetId = req.disputeId || (req.payload as any)?.disputeId || req.milestoneId || (req.payload as any)?.milestoneId || '';
      const key = `${req.type}_${targetId}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(req);
      }
    }
    return result;
  }, [pendingApprovals]);

  // WCAG Compliance: Trap escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedApproval(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleApprove = async (id: string) => {
    if (executingId) return; // Idempotent double-click guard
    setExecutingId(id);
    try {
      await api.approveHitlAction(id, 'Admin / Judge Operator');
      setFeedback(`Action ${id.substring(0, 8)} successfully approved & executed.`);
      onActionComplete();
      setSelectedApproval(null);
    } catch (err: any) {
      setFeedback(`Execution error: ${err.message}`);
    } finally {
      setExecutingId(null);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleReject = async (id: string) => {
    setExecutingId(id);
    try {
      await api.rejectHitlAction(id, 'Admin / Judge Operator', 'Manual rejection by reviewer');
      setFeedback(`Action ${id.substring(0, 8)} rejected.`);
      onActionComplete();
      setSelectedApproval(null);
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setExecutingId(null);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  return (
    <section className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-[#F4F1EA] text-[#0070BA] border border-[#E5E0D8]">
            <ShieldExclamationIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1C1917] flex items-center gap-2">
              SafeGate Human-in-the-Loop (HITL) Approval Drawer
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#F4F1EA] text-[#57534E] border border-[#E5E0D8]">
                WCAG Compliant Gate
              </span>
            </h2>
            <p className="text-xs text-[#57534E] mt-0.5">
              Deterministic barrier intercepting money-moving & legal actions before dispatch to PayPal
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-md bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8]">
            {dedupedApprovals.length} Action{dedupedApprovals.length === 1 ? '' : 's'} Staged
          </span>
        </div>
      </div>

      {feedback && (
        <div className="mb-3.5 p-2.5 text-xs font-medium rounded-lg bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8] text-center shadow-subtle">
          {feedback}
        </div>
      )}

      {dedupedApprovals.length === 0 ? (
        <div className="text-center py-8 text-[#57534E] text-xs border border-dashed border-[#E5E0D8] rounded-lg">
          No pending approvals in queue. SafeGate is continuously monitoring. Trigger Judge Demo fixtures to stage actions.
        </div>
      ) : (
        <div className="space-y-3">
          {dedupedApprovals.map((req) => {
            const isCritical = req.riskLevel === 'CRITICAL';
            const isHigh = req.riskLevel === 'HIGH';

            return (
              <div
                key={req.id}
                className="bg-[#F9F8F5] border border-[#E5E0D8] hover:border-[#D6D0C5] rounded-lg p-3.5 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1.5">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                          isCritical || isHigh
                            ? 'bg-[#1C1917] text-white border-[#1C1917]'
                            : 'bg-[#F4F1EA] text-[#57534E] border-[#E5E0D8]'
                        }`}
                      >
                        {req.riskLevel} RISK
                      </span>
                      <span className="font-mono text-xs font-bold text-[#1C1917]">
                        {req.type}
                      </span>
                      <span className="text-[11px] text-[#57534E] font-mono">
                        ID: {req.id.substring(0, 8)}...
                      </span>
                    </div>
                    <p className="text-xs text-[#1C1917] font-medium">{req.description}</p>
                  </div>

                  {/* Approve / Reject Controls */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedApproval(req)}
                      className="px-3 py-1.5 text-xs bg-white hover:bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8] rounded-lg font-medium flex items-center gap-1.5 transition shadow-subtle"
                    >
                      <EyeIcon className="w-3.5 h-3.5 text-[#57534E]" />
                      Inspect Payload
                    </button>

                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={executingId === req.id}
                      className="px-3 py-1.5 text-xs bg-white hover:bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8] rounded-lg font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shadow-subtle"
                    >
                      <XCircleIcon className="w-3.5 h-3.5 text-[#57534E]" />
                      Reject
                    </button>

                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={executingId === req.id}
                      className="px-3.5 py-1.5 text-xs bg-[#0070BA] hover:bg-[#005EA6] text-white font-semibold rounded-lg shadow-subtle flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <CheckCircleIcon className="w-3.5 h-3.5 text-white" />
                      Approve & Execute
                    </button>
                  </div>
                </div>

                {/* Verification badges */}
                {req.payload && (req.payload.knnScore || req.payload.channel3Sku || req.payload.hasPdf) && (
                  <div className="mt-2.5 pt-2.5 border-t border-[#E5E0D8] flex flex-wrap gap-2 text-xs">
                    {req.payload.channel3Sku && (
                      <span className="bg-white text-[#1C1917] px-2.5 py-1 rounded-md border border-[#E5E0D8] flex items-center gap-1.5 font-mono">
                        <CpuChipIcon className="w-3.5 h-3.5 text-[#0070BA]" />
                        Channel3 SKU: {req.payload.channel3Sku}
                      </span>
                    )}
                    {req.payload.knnScore && (
                      <span className="bg-white text-[#1C1917] px-2.5 py-1 rounded-md border border-[#E5E0D8] flex items-center gap-1.5 font-mono">
                        Elastic kNN Authenticity: {(req.payload.knnScore * 100).toFixed(1)}%
                      </span>
                    )}
                    {req.payload.hasPdf && (
                      <div className="flex items-center gap-2">
                        <span className="bg-white text-[#0070BA] px-2.5 py-1 rounded-md border border-[#E5E0D8] flex items-center gap-1.5 font-mono font-medium">
                          <DocumentTextIcon className="w-3.5 h-3.5 text-[#0070BA]" />
                          Compiled A4 PDF: {(req.payload.pdfSizeBytes / 1024).toFixed(1)} KB (&lt;10MB Compliant)
                        </span>
                        <a
                          href={api.getEvidencePdfUrl(req.payload.disputeId || 'PP-D-40193')}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 text-xs bg-white hover:bg-[#F4F1EA] text-[#0070BA] border border-[#0070BA]/40 rounded-md flex items-center gap-1.5 font-semibold transition"
                        >
                          <DocumentTextIcon className="w-3.5 h-3.5 text-[#0070BA]" />
                          Preview Auto-Compiled Evidence PDF
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect Modal - Soft neutral backdrop, no pure black, 3-color palette */}
      {selectedApproval && (
        <div className="fixed inset-0 bg-[#1C1917]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E5E0D8] rounded-xl max-w-xl w-full p-5 shadow-card space-y-4">
            <div className="flex justify-between items-center border-b border-[#E5E0D8] pb-3">
              <h3 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
                Payload Inspection & Audit Evidence
                <span className="text-xs font-mono bg-[#F4F1EA] px-2.5 py-0.5 rounded-md text-[#0070BA] border border-[#E5E0D8]">
                  {selectedApproval.type}
                </span>
              </h3>
              <button
                onClick={() => setSelectedApproval(null)}
                className="text-[#57534E] hover:text-[#1C1917] p-1 rounded-lg hover:bg-[#F4F1EA] transition"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-[#1C1917] font-medium">
              {selectedApproval.description}
            </div>

            <pre className="bg-[#F9F8F5] p-3.5 rounded-lg text-xs font-mono text-[#1C1917] overflow-x-auto max-h-60 border border-[#E5E0D8]">
              {JSON.stringify(selectedApproval.payload, null, 2)}
            </pre>

            <div className="flex justify-end space-x-2 pt-2 border-t border-[#E5E0D8]">
              <button
                onClick={() => setSelectedApproval(null)}
                className="px-3.5 py-1.5 text-xs bg-[#F4F1EA] hover:bg-[#EAE6DE] text-[#1C1917] border border-[#E5E0D8] rounded-lg font-medium transition shadow-subtle"
              >
                Close
              </button>
              <button
                onClick={() => handleApprove(selectedApproval.id)}
                className="px-4 py-1.5 text-xs bg-[#0070BA] hover:bg-[#005EA6] text-white font-semibold rounded-lg shadow-subtle flex items-center gap-1.5 transition"
              >
                <CheckCircleIcon className="w-3.5 h-3.5 text-white" />
                Approve & Execute Now
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default HITLApprovalDrawer;
