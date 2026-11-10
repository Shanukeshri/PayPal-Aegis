import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  XCircle,
  FileText,
  Cpu,
  Eye,
  X,
} from 'lucide-react';
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

  const handleApprove = async (id: string) => {
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
    <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 sm:p-8 shadow-card">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-700 shrink-0">
            <ShieldAlert className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#0F172A] leading-[1.5]">
                SafeGate Human-in-the-Loop (HITL) Approval Drawer
              </h2>
              <span className="h-6 px-2 rounded-lg text-xs font-medium bg-[#F1F5F9] text-[#4B5563] border border-[#E2E8F0] inline-flex items-center">
                WCAG Compliant Gate
              </span>
            </div>
            <p className="text-sm font-normal text-[#6B7280] leading-[1.6] mt-2">
              Deterministic barrier intercepting money-moving & legal actions before dispatch to PayPal
            </p>
          </div>
        </div>

        <div className="shrink-0">
          <span className="inline-flex items-center h-8 px-4 rounded-lg text-xs font-medium bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] tabular-nums">
            {pendingApprovals.length} Action{pendingApprovals.length === 1 ? '' : 's'} Staged
          </span>
        </div>
      </div>

      {/* Execution Feedback */}
      {feedback && (
        <div className="mb-6 p-4 text-sm font-medium leading-[1.6] rounded-lg bg-blue-50 text-[#003087] border border-blue-200 text-center">
          {feedback}
        </div>
      )}

      {/* Empty State or Staged Actions */}
      {pendingApprovals.length === 0 ? (
        <div className="bg-[#F8FAFC] border border-dashed border-[#E2E8F0] rounded-xl p-8 flex flex-col items-center justify-center text-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center text-[#0070BA] mb-2">
            <ShieldCheck className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <p className="text-sm font-bold text-[#0F172A] leading-[1.5]">
            No pending approvals in queue
          </p>
          <p className="text-sm font-normal text-[#6B7280] max-w-md leading-[1.6]">
            SafeGate is continuously monitoring outbound PayPal calls. Trigger Judge Demo fixtures 3 or 4 to stage an approval.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingApprovals.map((req) => {
            const isCritical = req.riskLevel === 'CRITICAL';
            const isHigh = req.riskLevel === 'HIGH';

            return (
              <div
                key={req.id}
                className="bg-[#F8FAFC] border border-[#E2E8F0] hover:border-slate-300 rounded-xl p-6 transition-all duration-200"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  {/* Action Metadata & Summary */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`h-6 px-2 rounded-lg text-xs font-bold uppercase inline-flex items-center border ${
                          isCritical
                            ? 'bg-red-50 text-red-800 border-red-200'
                            : isHigh
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-blue-50 text-[#003087] border-blue-200'
                        }`}
                      >
                        {req.riskLevel} RISK
                      </span>
                      <span className="text-sm font-bold text-[#0F172A] tabular-nums">
                        {req.type}
                      </span>
                      <span className="text-xs font-normal text-[#6B7280] tabular-nums">
                        ID: {req.id.substring(0, 8)}...
                      </span>
                    </div>
                    <p className="text-sm font-normal text-[#0F172A] leading-[1.6]">
                      {req.description}
                    </p>
                  </div>

                  {/* Action Controls: Right-Aligned Group */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedApproval(req)}
                      className="h-10 px-4 text-sm font-medium bg-transparent hover:bg-white active:bg-slate-100 text-[#0F172A] border border-[#E2E8F0] rounded-lg inline-flex items-center gap-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070BA] focus-visible:ring-offset-2"
                    >
                      <Eye className="w-4 h-4 text-[#6B7280]" strokeWidth={1.75} />
                      <span>Inspect Payload</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReject(req.id)}
                      disabled={executingId === req.id}
                      className="h-10 px-4 text-sm font-medium bg-transparent hover:bg-red-50 active:bg-red-100 text-red-800 border border-[#E2E8F0] hover:border-red-200 rounded-lg inline-flex items-center gap-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070BA] focus-visible:ring-offset-2 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4 text-red-700" strokeWidth={1.75} />
                      <span>Reject</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApprove(req.id)}
                      disabled={executingId === req.id}
                      className="h-10 px-4 text-sm font-bold bg-[#0070BA] hover:bg-[#003087] active:opacity-95 text-white rounded-lg shadow-subtle inline-flex items-center gap-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070BA] focus-visible:ring-offset-2 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" strokeWidth={1.75} />
                      <span>Approve & Execute</span>
                    </button>
                  </div>
                </div>

                {/* Verification Evidence Badges */}
                {req.payload && (req.payload.knnScore || req.payload.channel3Sku || req.payload.hasPdf) && (
                  <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex flex-wrap gap-2">
                    {req.payload.channel3Sku && (
                      <span className="h-8 px-2 bg-white text-[#003087] rounded-lg border border-[#E2E8F0] inline-flex items-center gap-2 text-xs font-medium tabular-nums">
                        <Cpu className="w-4 h-4 text-[#0070BA]" strokeWidth={1.75} />
                        <span>Channel3 SKU: {req.payload.channel3Sku}</span>
                      </span>
                    )}
                    {req.payload.knnScore && (
                      <span className="h-8 px-2 bg-white text-[#0F172A] rounded-lg border border-[#E2E8F0] inline-flex items-center gap-2 text-xs font-medium tabular-nums">
                        <ShieldCheck className="w-4 h-4 text-[#0070BA]" strokeWidth={1.75} />
                        <span>Elastic kNN Authenticity: {(req.payload.knnScore * 100).toFixed(1)}%</span>
                      </span>
                    )}
                    {req.payload.hasPdf && (
                      <span className="h-8 px-2 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 inline-flex items-center gap-2 text-xs font-medium tabular-nums">
                        <FileText className="w-4 h-4 text-emerald-700" strokeWidth={1.75} />
                        <span>
                          Compiled A4 PDF: {(req.payload.pdfSizeBytes / 1024).toFixed(1)} KB (&lt;10MB Compliant)
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect Payload Modal */}
      {selectedApproval && (
        <div className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E8F0] rounded-xl max-w-2xl w-full p-6 sm:p-8 shadow-modal space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-[#0F172A] leading-[1.5]">
                  Payload Inspection & Audit Evidence
                </h3>
                <span className="h-6 px-2 rounded-lg text-xs font-medium bg-[#F1F5F9] text-[#003087] border border-[#E2E8F0] inline-flex items-center tabular-nums">
                  {selectedApproval.type}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedApproval(null)}
                aria-label="Close payload inspection modal"
                className="w-8 h-8 rounded-lg bg-transparent hover:bg-slate-50 text-[#6B7280] hover:text-[#0F172A] border border-[#E2E8F0] inline-flex items-center justify-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070BA]"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <p className="text-sm font-normal text-[#0F172A] leading-[1.6]">
              {selectedApproval.description}
            </p>

            <pre className="bg-[#0F172A] text-slate-100 p-4 rounded-lg text-xs leading-[1.6] overflow-x-auto max-h-64 border border-slate-800 tabular-nums">
              {JSON.stringify(selectedApproval.payload, null, 2)}
            </pre>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setSelectedApproval(null)}
                className="h-10 px-4 text-sm font-medium bg-transparent hover:bg-slate-50 text-[#0F172A] border border-[#E2E8F0] rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070BA] focus-visible:ring-offset-2"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleApprove(selectedApproval.id)}
                disabled={executingId === selectedApproval.id}
                className="h-10 px-4 text-sm font-bold bg-[#0070BA] hover:bg-[#003087] text-white rounded-lg shadow-subtle inline-flex items-center gap-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070BA] focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" strokeWidth={1.75} />
                <span>Approve & Execute Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default HITLApprovalDrawer;
