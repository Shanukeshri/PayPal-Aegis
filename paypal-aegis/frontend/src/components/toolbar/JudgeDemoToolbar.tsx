import React, { useState } from 'react';
import {
  PlayIcon,
  ForwardIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  BoltIcon,
  ArrowDownTrayIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

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
}

export const JudgeDemoToolbar: React.FC<JudgeDemoToolbarProps> = ({
  onActionComplete,
  statusInfo,
  onToggleSandbox,
  isSandboxOpen,
  onBeforeAction,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const showBanner = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setBannerMessage({ text, type });
    setTimeout(() => setBannerMessage(null), 6000);
  };

  const handleSeedContract = async () => {
    setLoadingAction('seed');
    onBeforeAction?.('Seed Contract & Orders v2 Hold');
    try {
      const res = await api.fixtureSeedContract();
      showBanner(res.message || 'Milestone 1 locked in escrow hold (intent: AUTHORIZE)', 'success');
      onActionComplete();
    } catch (err: any) {
      showBanner(err.message || 'Error running fixture', 'warning');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFastForwardDay3 = async () => {
    setLoadingAction('day3');
    onBeforeAction?.('Day-3 Reauthorization Timer');
    try {
      const res = await api.fixtureFastForwardDay3();
      showBanner(res.message || 'Day-3 Reauthorization executed. authorization_id rotated.', 'info');
      onActionComplete();
    } catch (err: any) {
      showBanner(err.message || 'Error running fixture', 'warning');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleVerifyDeliverable = async () => {
    setLoadingAction('verify');
    onBeforeAction?.('Channel3 & Elastic Deliverable Verification');
    try {
      const res = await api.fixtureVerifyDeliverable();
      showBanner(res.message || 'Deliverable verified via Channel3 & Elastic. Capture staged in HITL queue.', 'success');
      onActionComplete();
    } catch (err: any) {
      showBanner(err.message || 'Error running fixture', 'warning');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSimulateDispute = async () => {
    setLoadingAction('dispute');
    onBeforeAction?.('SNAD Dispute Simulation & Shield');
    try {
      const res = await api.fixtureSimulateDispute();
      showBanner(res.message || 'SNAD dispute injected at 1.42% ratio. Auto-defense initiated.', 'warning');
      onActionComplete();
    } catch (err: any) {
      showBanner(err.message || 'Error running fixture', 'warning');
    } finally {
      setLoadingAction(null);
    }
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
    <header className="bg-white border-b border-[#E5E0D8] px-4 py-3 sticky top-0 z-50 shadow-subtle">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand identity & Environment status */}
        <div className="flex items-center space-x-3.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#0070BA] flex items-center justify-center font-bold text-white shadow-subtle">
              <ShieldCheckIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-[#1C1917] block">
                PayPal Aegis
              </span>
              <span className="text-[11px] text-[#57534E] font-medium">
                Autonomous Escrow OS
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 border-l border-[#E5E0D8] pl-3.5">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border bg-[#F4F1EA] text-[#1C1917] border-[#E5E0D8]">
              <span className="w-2 h-2 rounded-full mr-2 bg-[#0070BA]"></span>
              {isSimulated ? 'PayPal Sandbox Mode' : 'PayPal Live Sandbox'}
            </span>

            {statusInfo.pendingApprovalsCount ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[#F4F1EA] text-[#0070BA] border border-[#0070BA]/30">
                <ExclamationTriangleIcon className="w-3.5 h-3.5 mr-1.5 text-[#0070BA]" />
                {statusInfo.pendingApprovalsCount} Action{statusInfo.pendingApprovalsCount === 1 ? '' : 's'} Pending
              </span>
            ) : null}
          </div>
        </div>

        {/* 1-Click Judge Demo Toolbar Controls + Custom Input Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {onToggleSandbox && (
            <button
              onClick={onToggleSandbox}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border shadow-subtle transition ${
                isSandboxOpen
                  ? 'bg-[#0070BA] text-white border-[#0070BA]'
                  : 'bg-[#F4F1EA] hover:bg-[#E5E0D8] text-[#1C1917] border-[#0070BA]/40'
              }`}
              title="Toggle Custom Input Sandbox & Live Payload Playground Drawer"
            >
              <CommandLineIcon className={`w-3.5 h-3.5 ${isSandboxOpen ? 'text-white' : 'text-[#0070BA]'}`} />
              <span>Custom Input Mode {isSandboxOpen ? '▲' : '▼'}</span>
            </button>
          )}

          <span className="text-xs uppercase tracking-wider text-[#57534E] font-semibold mr-1.5 flex items-center gap-1.5">
            <BoltIcon className="w-4 h-4 text-[#57534E]" />
            Fixtures:
          </span>

          <button
            onClick={handleSeedContract}
            disabled={!!loadingAction}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white shadow-subtle transition disabled:opacity-50"
            title="Step 1: Ingests SOW into Gantt and creates PayPal Orders v2 intent: AUTHORIZE hold"
          >
            <PlayIcon className="w-3.5 h-3.5 text-white" />
            <span>1. Seed Contract & Hold</span>
          </button>

          <button
            onClick={handleFastForwardDay3}
            disabled={!!loadingAction}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8] shadow-subtle transition disabled:opacity-50"
            title="Step 2: Fast-forwards 72h timer, mutates authorization_id, updates pointer in ledger"
          >
            <ForwardIcon className="w-3.5 h-3.5 text-[#0070BA]" />
            <span>2. Fast-Forward Day-3</span>
          </button>

          <button
            onClick={handleVerifyDeliverable}
            disabled={!!loadingAction}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8] shadow-subtle transition disabled:opacity-50"
            title="Step 3: Queries Channel3 100M+ SKUs & Elastic kNN vector embeddings, stages capture in HITL"
          >
            <CheckCircleIcon className="w-3.5 h-3.5 text-[#0070BA]" />
            <span>3. Verify Deliverable</span>
          </button>

          <button
            onClick={handleSimulateDispute}
            disabled={!!loadingAction}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8] shadow-subtle transition disabled:opacity-50"
            title="Step 4: Injects SNAD dispute at 1.42% ratio; tests $0 make-offer vs auto-compiled A4 PDF"
          >
            <ExclamationTriangleIcon className="w-3.5 h-3.5 text-[#57534E]" />
            <span>4. Simulate Dispute (1.42%)</span>
          </button>

          <button
            onClick={handleDownloadAuditLogs}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F4F1EA] hover:bg-[#E5E0D8] text-[#1C1917] border border-[#0070BA]/30 shadow-subtle transition"
            title="Download Live E2E Audit Logs (.json) for Judge Review"
          >
            <ArrowDownTrayIcon className="w-3.5 h-3.5 text-[#0070BA]" />
            <span>Audit Logs (.json)</span>
          </button>

          <button
            onClick={handleReset}
            disabled={!!loadingAction}
            className="p-2 text-xs rounded-lg bg-white hover:bg-[#F4F1EA] text-[#57534E] hover:text-[#1C1917] border border-[#E5E0D8] shadow-subtle transition"
            title="Reset store to clean demo state"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating notification banner */}
      {bannerMessage && (
        <div className="mt-2.5 py-2 px-4 rounded-lg text-xs font-medium text-center transition-all border border-[#E5E0D8] bg-[#F4F1EA] text-[#1C1917] shadow-subtle">
          {bannerMessage.text}
        </div>
      )}
    </header>
  );
};

export default JudgeDemoToolbar;
