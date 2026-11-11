import React, { useState, useRef, useEffect } from 'react';
import {
  BellIcon,
  Bars3Icon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import type { UserRole, HITLApprovalRequest } from '../../types';

interface TopBarProps {
  role: UserRole;
  onChangeRole: (role: UserRole) => void;
  pendingApprovals: HITLApprovalRequest[];
  onApproveHitl: (id: string) => Promise<void>;
  onRejectHitl: (id: string) => Promise<void>;
  onNavigateDelivery: () => void;
  busyAction: string | null;
  mode?: string;
  socketConnected: boolean;
  onOpenMobileMenu: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  role,
  onChangeRole,
  pendingApprovals,
  onApproveHitl,
  onRejectHitl,
  onNavigateDelivery,
  busyAction,
  mode,
  socketConnected,
  onOpenMobileMenu,
}) => {
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setApprovalsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setApprovalsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const isSimulated = mode === 'DETERMINISTIC_SIMULATION';

  return (
    <header className="h-14 bg-white border-b border-[#E5E0D8] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile Menu + Role Switcher */}
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-1.5 rounded-lg text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F1EA]"
          aria-label="Open navigation menu"
        >
          <Bars3Icon className="w-5 h-5" />
        </button>

        <div
          role="group"
          aria-label="Active User Role"
          className="inline-flex items-center bg-[#F4F1EA] p-0.5 rounded-lg border border-[#E5E0D8]"
        >
          <button
            type="button"
            onClick={() => onChangeRole('CLIENT')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
              role === 'CLIENT'
                ? 'bg-white text-[#1C1917] shadow-subtle'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Client
          </button>
          <button
            type="button"
            onClick={() => onChangeRole('MERCHANT')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
              role === 'MERCHANT'
                ? 'bg-white text-[#1C1917] shadow-subtle'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Merchant
          </button>
        </div>
      </div>

      {/* Right: Notification Bell (SafeGate Approvals) + Sandbox Pill */}
      <div className="flex items-center space-x-3">
        {/* SafeGate Approvals Bell */}
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setApprovalsOpen((prev) => !prev)}
            className={`relative p-2 rounded-lg border transition ${
              approvalsOpen
                ? 'bg-[#E6F2FA] border-[#0070BA]/40 text-[#0070BA]'
                : 'bg-white border-[#E5E0D8] text-[#57534E] hover:text-[#1C1917] hover:bg-[#F9F8F5]'
            }`}
            aria-label="Open SafeGate Approvals"
            title="SafeGate Approvals"
          >
            <BellIcon className="w-4 h-4" />
            {pendingApprovals.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0070BA] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                {pendingApprovals.length}
              </span>
            )}
          </button>

          {approvalsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl border border-[#E5E0D8] shadow-card z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E5E0D8] bg-[#F9F8F5] flex items-center justify-between">
                <span className="text-xs font-bold text-[#1C1917] flex items-center gap-1.5">
                  <ShieldCheckIcon className="w-4 h-4 text-[#0070BA]" />
                  SafeGate Approvals
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setApprovalsOpen(false);
                    onNavigateDelivery();
                  }}
                  className="text-[11px] font-semibold text-[#0070BA] hover:underline"
                >
                  Open Delivery →
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#E5E0D8]">
                {pendingApprovals.length === 0 ? (
                  <div className="p-5 text-center text-xs text-[#78716C]">
                    No pending approvals right now.
                  </div>
                ) : (
                  pendingApprovals.map((item) => (
                    <div key={item.id} className="p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono font-bold text-[#0070BA]">
                          {item.type}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          {item.riskLevel} Risk
                        </span>
                      </div>
                      <p className="text-xs text-[#57534E] leading-relaxed">
                        {item.description}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={!!busyAction}
                          onClick={() => onRejectHitl(item.id)}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8] flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <XCircleIcon className="w-3.5 h-3.5 text-[#57534E]" />
                          <span>Reject</span>
                        </button>
                        <button
                          type="button"
                          disabled={!!busyAction}
                          onClick={() => onApproveHitl(item.id)}
                          className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {busyAction === `hitl:approve:${item.id}` ? (
                            <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                          )}
                          <span>Approve</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Compact Sandbox Status Badge */}
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8]"
          title={
            isSimulated
              ? 'PayPal Sandbox Mode (Deterministic Simulation)'
              : 'PayPal Live Sandbox Connected'
          }
        >
          <span>Sandbox</span>
          <span
            className={`w-2 h-2 rounded-full ${
              socketConnected ? 'bg-emerald-500' : 'bg-[#0070BA]'
            }`}
          />
        </span>
      </div>
    </header>
  );
};

export default TopBar;

