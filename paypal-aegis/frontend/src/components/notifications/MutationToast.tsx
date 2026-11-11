import React from 'react';
import { BoltIcon, XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import type { StateMutationDiff } from '../../types';

interface MutationToastProps {
  diff: StateMutationDiff | null;
  onDismiss: () => void;
  onInspectDevTools: () => void;
}

export const MutationToast: React.FC<MutationToastProps> = ({
  diff,
  onDismiss,
  onInspectDevTools,
}) => {
  if (!diff) return null;

  const firstChange = diff.changes[0];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-40 max-w-sm w-[calc(100%-2rem)] bg-white border border-[#E5E0D8] rounded-xl p-3.5 shadow-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-[#E6F2FA] text-[#0070BA] flex-shrink-0 mt-0.5">
            <BoltIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#1C1917] truncate">
              {diff.actionLabel}
            </p>
            {firstChange && (
              <p className="text-[11px] font-mono text-[#57534E] mt-0.5 flex flex-wrap items-center gap-1">
                <span>{firstChange.field}:</span>
                <span className="line-through text-[#78716C]">
                  {firstChange.previousValue}
                </span>
                <ArrowRightIcon className="w-3 h-3 text-[#0070BA]" />
                <span className="font-semibold text-[#0070BA]">
                  {firstChange.newValue}
                </span>
              </p>
            )}
            <button
              type="button"
              onClick={onInspectDevTools}
              className="mt-1.5 text-[11px] font-semibold text-[#0070BA] hover:underline"
            >
              View full diff in Dev tools →
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="p-1 rounded-md text-[#78716C] hover:text-[#1C1917] hover:bg-[#F4F1EA]"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default MutationToast;

