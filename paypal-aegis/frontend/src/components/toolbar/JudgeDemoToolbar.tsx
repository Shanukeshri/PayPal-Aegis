import React, { useState } from 'react';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  CommandLineIcon,
  SparklesIcon,
  EyeIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

export type AgentKey = 'ContractParser' | 'DeliveryAuditor' | 'DisputeStrategist' | null;

interface JudgeDemoToolbarProps {
  onActionComplete: () => void;
  statusInfo: {
    mode?: string;
    paypalConfigured?: boolean;
    pendingApprovalsCount?: number;
  };
  onToggleSandbox?: () => void;
  isSandboxOpen?: boolean;
  onBeforeAction?: (actionName: string) => void;
  activeAgent?: AgentKey;
  isExecuting?: boolean;
}

export const JudgeDemoToolbar: React.FC<JudgeDemoToolbarProps> = ({
  onActionComplete,
  statusInfo,
  onToggleSandbox,
  isSandboxOpen,
  onBeforeAction,
  activeAgent,
  isExecuting,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const showBanner = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setBannerMessage({ text, type });
    setTimeout(() => setBannerMessage(null), 5000);
  };

  const handleReset = async () => {
    setLoadingAction('reset');
    try {
      await api.resetDemo();
      showBanner('All state reset to initial demo values.', 'info');
      onActionComplete();
    } catch (err: any) {
      showBanner(err.message || 'Error resetting', 'warning');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownloadAuditLogs = () => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:3001/api');
    window.open(`${apiUrl}/demo/audit-logs?download=true`, '_blank');
  };

  const isSimulated = statusInfo.mode === 'DETERMINISTIC_SIMULATION';

  return (
    <header className="bg-white border-b border-[#E5E0D8] px-4 py-1.5 sticky top-0 z-40 shadow-subtle">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand identity & Environment status */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0070BA] flex items-center justify-center font-bold text-white shadow-subtle">
              <ShieldCheckIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-[#1C1917]">
                  PayPal Aegis
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-[#0070BA]/10 text-[#0070BA] border border-[#0070BA]/20">
                  v2.0 OS
                </span>
              </div>
              <span className="text-[11px] text-[#57534E] font-medium block">
                Autonomous Milestone Escrow & Dispute Shield
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-2 border-l border-[#E5E0D8] pl-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border bg-[#F4F1EA] text-[#1C1917] border-[#E5E0D8]">
              <span className="w-2 h-2 rounded-full mr-1.5 bg-[#0070BA] animate-pulse"></span>
              {isSimulated ? 'PayPal Sandbox Mode' : 'PayPal Live Sandbox'}
            </span>

            {statusInfo.pendingApprovalsCount ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#F4F1EA] text-[#0070BA] border border-[#0070BA]/30">
                <ExclamationTriangleIcon className="w-3.5 h-3.5 mr-1 text-[#0070BA]" />
                {statusInfo.pendingApprovalsCount} Action{statusInfo.pendingApprovalsCount === 1 ? '' : 's'} Pending
              </span>
            ) : null}
          </div>
        </div>

        {/* Active Autonomous Agents Telemetry Badge Strip */}
        <div className="hidden lg:flex items-center space-x-2 bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg px-2.5 py-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] mr-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            Agents:
          </div>

          {/* Agent 1 */}
          <div
            className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] transition-colors border ${
              activeAgent === 'ContractParser' && isExecuting
                ? 'bg-[#0070BA]/15 text-[#0070BA] border-[#0070BA]/40 font-bold ring-1 ring-[#0070BA]/30'
                : 'bg-white text-[#1C1917] border-[#E5E0D8]'
            }`}
            title="Contract Parser Agent grounded with APIMatic v2 Schema Router"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                activeAgent === 'ContractParser' && isExecuting
                  ? 'bg-[#0070BA] animate-pulse'
                  : 'bg-emerald-500'
              }`}
            />
            <span className="font-medium">ContractParser</span>
            <span className="text-[9px] text-[#57534E] font-mono hidden xl:inline">
              (APIMatic v2)
            </span>
          </div>

          {/* Agent 2 */}
          <div
            className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] transition-colors border ${
              activeAgent === 'DeliveryAuditor' && isExecuting
                ? 'bg-[#0070BA]/15 text-[#0070BA] border-[#0070BA]/40 font-bold ring-1 ring-[#0070BA]/30'
                : 'bg-white text-[#1C1917] border-[#E5E0D8]'
            }`}
            title="Multimodal Verification Agent with Channel3 Catalog RAG & Elastic kNN Search"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                activeAgent === 'DeliveryAuditor' && isExecuting
                  ? 'bg-[#0070BA] animate-pulse'
                  : 'bg-emerald-500'
              }`}
            />
            <span className="font-medium">DeliveryAuditor</span>
            <span className="text-[9px] text-[#57534E] font-mono hidden xl:inline">
              (Channel3 + Elastic)
            </span>
          </div>

          {/* Agent 3 */}
          <div
            className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] transition-colors border ${
              activeAgent === 'DisputeStrategist' && isExecuting
                ? 'bg-[#0070BA]/15 text-[#0070BA] border-[#0070BA]/40 font-bold ring-1 ring-[#0070BA]/30'
                : 'bg-white text-[#1C1917] border-[#E5E0D8]'
            }`}
            title="Dispute Triage & Defense Agent with Elasticsearch Transactional RAG & A4 Legal Compiler"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                activeAgent === 'DisputeStrategist' && isExecuting
                  ? 'bg-[#0070BA] animate-pulse'
                  : 'bg-emerald-500'
              }`}
            />
            <span className="font-medium">DisputeStrategist</span>
            <span className="text-[9px] text-[#57534E] font-mono hidden xl:inline">
              (Audit RAG + A4)
            </span>
          </div>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex items-center space-x-2">
          {onToggleSandbox && (
            <button
              onClick={onToggleSandbox}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border shadow-subtle transition ${
                isSandboxOpen
                  ? 'bg-[#0070BA] text-white border-[#0070BA]'
                  : 'bg-[#F4F1EA] hover:bg-[#E5E0D8] text-[#1C1917] border-[#0070BA]/40'
              }`}
              title="Open Custom Input Sandbox Modal"
            >
              <CommandLineIcon className={`w-3.5 h-3.5 ${isSandboxOpen ? 'text-white' : 'text-[#0070BA]'}`} />
              <span>Edit Inputs / Custom Sandbox</span>
            </button>
          )}

          <button
            onClick={handleDownloadAuditLogs}
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8] shadow-subtle transition"
            title="Download Live E2E Audit Logs (.json) for Judge Review"
          >
            <ArrowDownTrayIcon className="w-3.5 h-3.5 text-[#0070BA]" />
            <span>Audit Logs (.json)</span>
          </button>

          <button
            onClick={handleReset}
            disabled={!!loadingAction}
            className="p-1.5 text-xs rounded-lg bg-white hover:bg-[#F4F1EA] text-[#57534E] hover:text-[#1C1917] border border-[#E5E0D8] shadow-subtle transition"
            title="Reset store to clean demo state"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loadingAction === 'reset' ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating notification banner */}
      {bannerMessage && (
        <div className="mt-2 py-1.5 px-3 rounded-lg text-xs font-medium text-center transition-all border border-[#E5E0D8] bg-[#F4F1EA] text-[#1C1917] shadow-subtle">
          {bannerMessage.text}
        </div>
      )}
    </header>
  );
};

export default JudgeDemoToolbar;
