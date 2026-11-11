import React, { useState, useEffect } from 'react';
import {
  ArrowRightIcon,
  BoltIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import type { StateMutationDiff, EcosystemActor } from '../../types';

interface StateMutationDiffBannerProps {
  diffs: StateMutationDiff[];
  showHistoryList?: boolean;
  onInspectLedger?: () => void;
}

function getActorBadge(actor: EcosystemActor) {
  if (actor === 'CLIENT') {
    return {
      label: '👤 Client Action',
      cls: 'bg-purple-50 text-purple-800 border-purple-200',
    };
  }
  if (actor === 'BUSINESS') {
    return {
      label: '🏢 Business Action',
      cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };
  }
  return {
    label: '⚡ PayPal Aegis Engine',
    cls: 'bg-[#E6F2FA] text-[#0070BA] border-[#0070BA]/30',
  };
}

function getNewValueStyles(highlightType?: string) {
  switch (highlightType) {
    case 'CAPTURED':
    case 'SETTLED':
    case 'SAFE':
      return {
        valueCls: 'text-emerald-800 bg-emerald-50 border-emerald-300',
        badgeCls: 'bg-emerald-600 text-white animate-pulse',
      };
    case 'DISPUTED':
      return {
        valueCls: 'text-amber-900 bg-amber-50 border-amber-300',
        badgeCls: 'bg-amber-600 text-white animate-pulse',
      };
    default:
      return {
        valueCls: 'text-[#0070BA] bg-[#E6F2FA] border-[#0070BA]/40',
        badgeCls: 'bg-[#0070BA] text-white animate-pulse',
      };
  }
}

export const StateMutationDiffBanner: React.FC<StateMutationDiffBannerProps> = ({
  diffs,
  showHistoryList = false,
  onInspectLedger,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset to latest diff whenever a new diff arrives
  useEffect(() => {
    setSelectedIndex(0);
  }, [diffs.length, diffs[0]?.id]);

  if (!diffs || diffs.length === 0) {
    return null;
  }

  const activeDiff = diffs[selectedIndex] || diffs[0];
  const actorBadge = getActorBadge(activeDiff.actor);

  const renderDiffCard = (diff: StateMutationDiff, isPrimary: boolean) => {
    const badge = getActorBadge(diff.actor);
    return (
      <div
        key={diff.id}
        className={`rounded-xl border p-4 shadow-subtle transition-all ${
          isPrimary
            ? 'bg-white border-[#0070BA]/40 ring-1 ring-[#0070BA]/20'
            : 'bg-[#F9F8F5] border-[#E5E0D8]'
        }`}
      >
        {/* Top Row: What Changed Header & Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E5E0D8]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-[#0070BA] text-white">
              <BoltIcon className="w-3 h-3" />
              What Changed
            </span>
            <h3 className="text-xs sm:text-sm font-bold text-[#1C1917]">
              {diff.actionLabel}
            </h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.cls}`}>
              {badge.label}
            </span>
            <span className="text-[10px] font-mono text-[#57534E] bg-[#F4F1EA] px-2 py-0.5 rounded border border-[#E5E0D8]">
              {diff.agentName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#78716C] flex items-center gap-1">
              <ClockIcon className="w-3 h-3" />
              {new Date(diff.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>

            {isPrimary && diffs.length > 1 && !showHistoryList && (
              <div className="flex items-center bg-[#F4F1EA] rounded-lg border border-[#E5E0D8] px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
                  disabled={selectedIndex === 0}
                  className="p-0.5 text-[#57534E] hover:text-[#1C1917] disabled:opacity-30"
                  title="Newer Mutation"
                >
                  <ChevronLeftIcon className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono font-bold px-1.5 text-[#1C1917]">
                  {selectedIndex + 1}/{diffs.length}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIndex((i) => Math.min(diffs.length - 1, i + 1))}
                  disabled={selectedIndex >= diffs.length - 1}
                  className="p-0.5 text-[#57534E] hover:text-[#1C1917] disabled:opacity-30"
                  title="Previous Mutation"
                >
                  <ChevronRightIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {isPrimary && onInspectLedger && (
              <button
                type="button"
                onClick={onInspectLedger}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#F4F1EA] hover:bg-[#E5E0D8] text-[#0070BA] border border-[#0070BA]/30 transition"
              >
                <TableCellsIcon className="w-3.5 h-3.5" />
                <span>Inspect Diff &amp; Ledger</span>
              </button>
            )}
          </div>
        </div>

        {/* Before -> After Field Diff Pills */}
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {diff.changes.map((c, idx) => {
            const styles = getNewValueStyles(c.highlightType);
            return (
              <div
                key={`${diff.id}-${idx}`}
                className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2"
              >
                <span className="text-[11px] font-bold text-[#57534E] uppercase tracking-wider font-mono">
                  {c.field}:
                </span>
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                  <span
                    className="line-through text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 text-[11px]"
                    title={`Previous value: ${c.previousValue}`}
                  >
                    {c.previousValue}
                  </span>
                  <ArrowRightIcon className="w-3.5 h-3.5 text-[#0070BA] flex-shrink-0" />
                  <span
                    className={`font-bold px-2 py-0.5 rounded border text-[11px] ${styles.valueCls}`}
                    title={`New value: ${c.newValue}`}
                  >
                    {c.newValue}
                  </span>
                  {c.badge && (
                    <span
                      className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm ${styles.badgeCls}`}
                    >
                      {c.badge}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Downstream Schedule & Ecosystem Impact */}
        <div className="mt-2.5 pt-2 border-t border-[#E5E0D8]/80 flex items-center gap-2 text-xs text-[#57534E]">
          <SparklesIcon className="w-4 h-4 text-[#0070BA] flex-shrink-0" />
          <span>
            <strong className="text-[#1C1917]">Downstream Impact:</strong> {diff.downstreamImpact}
          </span>
        </div>
      </div>
    );
  };

  if (showHistoryList) {
    return (
      <section aria-label="State Mutation Diff History" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#57534E] flex items-center gap-1.5">
            <BoltIcon className="w-4 h-4 text-[#0070BA]" />
            Chronological Before ➔ After State Mutation Audit ({diffs.length})
          </h3>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${actorBadge.cls}`}>
            Latest: {actorBadge.label}
          </span>
        </div>
        <div className="space-y-3">
          {diffs.slice(0, 6).map((d, idx) => renderDiffCard(d, idx === 0))}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Latest State Mutation Diff" className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-3">
      {renderDiffCard(activeDiff, true)}
    </section>
  );
};

export default StateMutationDiffBanner;

