import React, { useState } from 'react';
import {
  Play,
  FastForward,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Zap,
  Info,
} from 'lucide-react';
import api from '../../services/api';

interface JudgeDemoToolbarProps {
  onActionComplete: () => void;
  statusInfo: {
    mode?: string;
    paypalConfigured?: boolean;
    pendingApprovalsCount?: number;
  };
}

export const JudgeDemoToolbar: React.FC<JudgeDemoToolbarProps> = ({
  onActionComplete,
  statusInfo,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'warning';
  } | null>(null);

  const showBanner = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setBannerMessage({ text, type });
    setTimeout(() => setBannerMessage(null), 6000);
  };

  const handleSeedContract = async () => {
    setLoadingAction('seed');
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
    try {
      const res = await api.fixtureVerifyDeliverable();
      showBanner(
        res.message || 'Deliverable verified via Channel3 & Elastic. Capture staged in HITL queue.',
        'success'
      );
      onActionComplete();
    } catch (err: any) {
      showBanner(err.message || 'Error running fixture', 'warning');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSimulateDispute = async () => {
    setLoadingAction('dispute');
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

  const isSimulated = statusInfo.mode === 'DETERMINISTIC_SIMULATION';

  return (
    <header className="bg-white border-b border-[#E2E8F0] shadow-subtle sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        {/* Primary Navigation Row */}
        <div className="py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Brand Lockup */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#0070BA] flex items-center justify-center text-white shrink-0">
                <ShieldCheck className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div>
                <span className="text-base font-bold text-[#0F172A] leading-[1.5] block">
                  PayPal Aegis
                </span>
                <span className="text-xs font-normal text-[#6B7280] leading-[1.5] block">
                  Command OS
                </span>
              </div>
            </div>

            <div className="hidden sm:block h-8 w-px bg-[#E2E8F0]" aria-hidden="true" />

            {/* Environment & HITL Status Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 h-8 px-2 rounded-lg text-xs font-medium border ${
                  isSimulated
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isSimulated ? 'bg-amber-600' : 'bg-emerald-600'
                  }`}
                />
                {isSimulated ? 'Deterministic Simulation' : 'PayPal Live Sandbox'}
              </span>

              {statusInfo.pendingApprovalsCount ? (
                <span className="inline-flex items-center gap-2 h-8 px-2 rounded-lg text-xs font-bold bg-red-50 text-red-800 border border-red-200 tabular-nums">
                  <AlertTriangle className="w-4 h-4 text-red-700" strokeWidth={1.75} />
                  {statusInfo.pendingApprovalsCount} HITL Pending
                </span>
              ) : null}
            </div>
          </div>

          {/* Utility Reset Control */}
          <button
            type="button"
            onClick={handleReset}
            disabled={!!loadingAction}
            className="h-10 px-4 rounded-lg bg-transparent hover:bg-slate-50 active:bg-slate-100 text-[#0F172A] border border-[#E2E8F0] text-sm font-medium inline-flex items-center gap-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070BA] focus-visible:ring-offset-2 disabled:opacity-50"
            title="Reset store to clean demo state"
          >
            <RotateCcw className="w-4 h-4 text-[#6B7280]" strokeWidth={1.75} />
            <span>Reset</span>
          </button>
        </div>

        {/* 1-Click Judge Demo Fixtures Bar */}
        <div className="py-4 border-t border-[#E2E8F0]">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#0070BA]" strokeWidth={1.75} />
            <span className="text-xs font-medium uppercase tracking-wider text-[#6B7280] leading-[1.5]">
              Judge Demo Fixtures
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Primary CTA: Solid Brand Fill */}
            <button
              type="button"
              onClick={handleSeedContract}
              disabled={!!loadingAction}
              className="h-10 px-4 rounded-lg bg-[#0070BA] hover:bg-[#003087] active:opacity-95 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-subtle transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070BA] focus-visible:ring-offset-2 disabled:opacity-50"
              title="Step 1: Ingests SOW into Gantt and creates PayPal Orders v2 intent: AUTHORIZE hold"
            >
              <Play className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span className="truncate">1. Seed Contract & Lock Hold</span>
            </button>

            {/* Secondary Actions: Transparent with Subtle Border */}
            <button
              type="button"
              onClick={handleFastForwardDay3}
              disabled={!!loadingAction}
              className="h-10 px-4 rounded-lg bg-transparent hover:bg-slate-50 active:bg-slate-100 text-[#0F172A] border border-[#E2E8F0] text-xs font-medium inline-flex items-center justify-center gap-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070BA] focus-visible:ring-offset-2 disabled:opacity-50"
              title="Step 2: Fast-forwards 72h timer, mutates authorization_id, updates pointer in ledger"
            >
              <FastForward className="w-4 h-4 text-[#0070BA] shrink-0" strokeWidth={1.75} />
              <span className="truncate">2. Fast-Forward Day-3 (Rotate ID)</span>
            </button>

            <button
              type="button"
              onClick={handleVerifyDeliverable}
              disabled={!!loadingAction}
              className="h-10 px-4 rounded-lg bg-transparent hover:bg-slate-50 active:bg-slate-100 text-[#0F172A] border border-[#E2E8F0] text-xs font-medium inline-flex items-center justify-center gap-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070BA] focus-visible:ring-offset-2 disabled:opacity-50"
              title="Step 3: Queries Channel3 100M+ SKUs & Elastic kNN vector embeddings, stages capture in HITL"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" strokeWidth={1.75} />
              <span className="truncate">3. Verify Deliverable (Channel3 + Elastic)</span>
            </button>

            <button
              type="button"
              onClick={handleSimulateDispute}
              disabled={!!loadingAction}
              className="h-10 px-4 rounded-lg bg-transparent hover:bg-red-50 active:bg-red-100 text-red-800 border border-[#E2E8F0] hover:border-red-200 text-xs font-medium inline-flex items-center justify-center gap-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070BA] focus-visible:ring-offset-2 disabled:opacity-50"
              title="Step 4: Injects SNAD dispute at 1.42% ratio; tests $0 make-offer vs auto-compiled A4 PDF"
            >
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" strokeWidth={1.75} />
              <span className="truncate">4. Simulate SNAD Dispute (1.42% Ratio)</span>
            </button>
          </div>
        </div>

        {/* Inline Feedback Banner */}
        {bannerMessage && (
          <div className="pb-4">
            <div
              className={`p-4 rounded-lg text-sm font-medium leading-[1.6] border flex items-center justify-center gap-2 transition-all duration-200 ${
                bannerMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : bannerMessage.type === 'warning'
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-blue-50 text-[#003087] border-blue-200'
              }`}
            >
              {bannerMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              ) : bannerMessage.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              ) : (
                <Info className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              )}
              <span>{bannerMessage.text}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default JudgeDemoToolbar;
