import React, { useState } from 'react';
import {
  ClockIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  LockClosedIcon,
  InformationCircleIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';
import MutatedAuthLedger from '../dashboard/MutatedAuthLedger';
import BryntumGanttView from '../gantt/BryntumGanttView';
import type { Milestone, PayPalDispute, Project, UserRole } from '../../types';
import {
  getActiveMilestone,
  isMilestoneMutated,
  formatHoldStatusLabel,
} from '../../lib/workflow';

interface EscrowContractPageProps {
  role: UserRole;
  project?: Project;
  milestones: Milestone[];
  disputes: PayPalDispute[];
  busyAction: string | null;
  onSeedContract: () => Promise<void>;
  onLockMilestoneHold: (milestoneId: string) => Promise<void>;
  onFastForwardDay3: (milestoneId: string) => Promise<void>;
  onCapture: (milestoneId: string) => Promise<void>;
  onVoidMilestone: (milestoneId: string) => Promise<void>;
}

export const EscrowContractPage: React.FC<EscrowContractPageProps> = ({
  role,
  project,
  milestones,
  disputes,
  busyAction,
  onSeedContract,
  onLockMilestoneHold,
  onFastForwardDay3,
  onCapture,
  onVoidMilestone,
}) => {
  const [activeTab, setActiveTab] = useState<'milestones' | 'ledger' | 'timeline'>('milestones');

  const activeMilestone = getActiveMilestone(milestones);
  const reauthorizedMilestone = milestones.find(
    (m) => m.status === 'REAUTHORIZED' || isMilestoneMutated(m)
  );
  const totalContractAmount = milestones.reduce(
    (sum, m) => sum + parseFloat(m.amount.value || '0'),
    0
  );

  return (
    <div className="space-y-5">
      {/* Page Header & Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#1C1917] tracking-tight">
            Escrow &amp; Contract
          </h1>
          <p className="text-xs text-[#57534E] mt-0.5">
            {project?.name || 'Milestone contract, card authorization holds, and schedule timeline'}
          </p>
        </div>

        {/* Page Tabs: Milestones | Ledger | Timeline */}
        <div
          role="tablist"
          aria-label="Escrow views"
          className="inline-flex bg-[#F4F1EA] p-1 rounded-lg border border-[#E5E0D8]"
        >
          {[
            { id: 'milestones' as const, label: 'Milestones' },
            { id: 'ledger' as const, label: 'Ledger' },
            { id: 'timeline' as const, label: 'Timeline' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-white text-[#1C1917] shadow-subtle'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Card Hold Status Summary */}
      {activeMilestone && activeMilestone.status !== 'DRAFT' && (
        <div className="bg-white border border-[#E5E0D8] rounded-xl p-4 shadow-subtle flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-[#E6F2FA] text-[#0070BA]">
              <LockClosedIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#78716C]">Card Hold Status</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#E6F2FA] text-[#0070BA]">
                  {formatHoldStatusLabel(activeMilestone.status)}
                </span>
              </div>
              <p className="text-xs text-[#57534E] mt-0.5 font-mono">
                Order {activeMilestone.orderId || 'Pending'} · Auth{' '}
                {activeMilestone.activeAuthorizationId || 'N/A'} · Contract Total $
                {totalContractAmount.toFixed(2)} USD
              </p>
            </div>
          </div>

          {activeMilestone.captureId && (
            <span className="text-xs font-mono text-emerald-700 font-semibold">
              Receipt #{activeMilestone.captureId}
            </span>
          )}
        </div>
      )}

      {/* Small Day-3 Reauthorization Info Note */}
      {reauthorizedMilestone && (
        <div className="bg-[#E6F2FA]/60 border border-[#0070BA]/25 rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-[#1C1917]">
          <div className="flex items-center gap-2">
            <InformationCircleIcon className="w-4 h-4 text-[#0070BA] flex-shrink-0" />
            <span>
              Day-3 reauthorization extended the 72h hold automatically. Authorization ID rotated to{' '}
              <span className="font-mono font-semibold text-[#0070BA]">
                {reauthorizedMilestone.activeAuthorizationId}
              </span>
              .
            </span>
          </div>
          {reauthorizedMilestone.originalAuthorizationId && (
            <span className="hidden sm:inline font-mono text-[11px] text-[#78716C] line-through">
              {reauthorizedMilestone.originalAuthorizationId}
            </span>
          )}
        </div>
      )}

      {/* TAB 1: Milestones */}
      {activeTab === 'milestones' && (
        <div className="space-y-3">
          {milestones.length === 0 ? (
            <div className="bg-white border border-[#E5E0D8] rounded-xl p-8 text-center space-y-3 shadow-subtle">
              <p className="text-sm font-semibold text-[#1C1917]">No contract milestones yet</p>
              <p className="text-xs text-[#57534E]">
                Initialize a milestone contract to place an escrow hold on Milestone 1.
              </p>
              <button
                type="button"
                disabled={busyAction === 'seed' || busyAction === 'custom-seed'}
                onClick={onSeedContract}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white transition disabled:opacity-50"
              >
                {busyAction === 'seed' || busyAction === 'custom-seed'
                  ? 'Initializing...'
                  : 'Initialize Contract & Hold'}
              </button>
            </div>
          ) : (
            milestones.map((m, idx) => {
              const isMutated = isMilestoneMutated(m);
              const prevUncaptured = idx > 0 && milestones[idx - 1].status !== 'CAPTURED';
              const statusLabel = formatHoldStatusLabel(m.status);

              return (
                <div
                  key={m.id}
                  className="bg-white border border-[#E5E0D8] rounded-xl p-4 shadow-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-[#78716C]">
                        Milestone {idx + 1}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                          m.status === 'CAPTURED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : m.status === 'VERIFIED'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : m.status === 'AUTHORIZED' || m.status === 'REAUTHORIZED'
                            ? 'bg-[#E6F2FA] text-[#0070BA] border-[#0070BA]/30'
                            : 'bg-[#F4F1EA] text-[#57534E] border-[#E5E0D8]'
                        }`}
                      >
                        {statusLabel}
                      </span>
                      {isMutated && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#F4F1EA] text-[#0070BA] border border-[#0070BA]/20">
                          Rotated
                        </span>
                      )}
                      {prevUncaptured && m.status === 'DRAFT' && (
                        <span className="text-[11px] text-[#78716C]">
                          · Locked until Milestone {idx} settles
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-[#1C1917]">{m.name}</h3>
                    <p className="text-xs text-[#57534E]">{m.description}</p>

                    {m.activeAuthorizationId && (
                      <p className="text-[11px] font-mono text-[#78716C] pt-1">
                        Auth ID: <span className="text-[#1C1917]">{m.activeAuthorizationId}</span>
                        {m.captureId ? ` · Capture ${m.captureId}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 flex-shrink-0">
                    <span className="text-base font-bold font-mono text-[#1C1917]">
                      ${m.amount.value} {m.amount.currency_code}
                    </span>

                    <div className="flex items-center gap-2">
                      {m.status === 'DRAFT' && !prevUncaptured && (
                        <button
                          type="button"
                          disabled={!!busyAction}
                          onClick={() => onLockMilestoneHold(m.id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white transition disabled:opacity-50"
                        >
                          {busyAction === `hold:${m.id}` ? 'Locking...' : 'Lock Hold'}
                        </button>
                      )}

                      {role === 'MERCHANT' && m.status === 'AUTHORIZED' && (
                        <>
                          <button
                            type="button"
                            disabled={!!busyAction}
                            onClick={() => onFastForwardDay3(m.id)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-[#F4F1EA] text-[#0070BA] border border-[#0070BA]/30 flex items-center gap-1.5 transition disabled:opacity-50"
                          >
                            <ArrowPathIcon
                              className={`w-3.5 h-3.5 ${
                                busyAction === 'fast-forward' ? 'animate-spin' : ''
                              }`}
                            />
                            <span>Renew 72h Hold</span>
                          </button>
                          <button
                            type="button"
                            disabled={!!busyAction}
                            onClick={() => onVoidMilestone(m.id)}
                            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-[#F4F1EA] text-[#57534E] border border-[#E5E0D8] flex items-center gap-1 transition disabled:opacity-50"
                            title="Void authorization hold"
                          >
                            <NoSymbolIcon className="w-3.5 h-3.5" />
                            <span>{busyAction === `void:${m.id}` ? 'Voiding...' : 'Void'}</span>
                          </button>
                        </>
                      )}

                      {role === 'MERCHANT' && m.status === 'VERIFIED' && (
                        <button
                          type="button"
                          disabled={!!busyAction}
                          onClick={() => onCapture(m.id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white flex items-center gap-1.5 transition disabled:opacity-50"
                        >
                          <CheckCircleIcon className="w-3.5 h-3.5" />
                          <span>{busyAction === `capture:${m.id}` ? 'Capturing...' : 'Capture'}</span>
                        </button>
                      )}

                      {m.status === 'REAUTHORIZED' && (
                        <span className="inline-flex items-center gap-1 text-xs text-[#0070BA] font-medium">
                          <ClockIcon className="w-3.5 h-3.5" />
                          72h active
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: Ledger */}
      {activeTab === 'ledger' && (
        <MutatedAuthLedger
          milestones={milestones}
          onFastForwardDay3={onFastForwardDay3}
          onCapture={onCapture}
        />
      )}

      {/* TAB 3: Timeline */}
      {activeTab === 'timeline' && (
        <BryntumGanttView milestones={milestones} disputes={disputes} />
      )}
    </div>
  );
};

export default EscrowContractPage;

