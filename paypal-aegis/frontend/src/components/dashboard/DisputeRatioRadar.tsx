import React from 'react';
import {
  ExclamationCircleIcon,
  ShieldExclamationIcon,
  ArrowTrendingUpIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import type { DisputeRatioSnapshot } from '../../types';

interface DisputeRatioRadarProps {
  ratioSnapshot: DisputeRatioSnapshot | null;
}

export const DisputeRatioRadar: React.FC<DisputeRatioRadarProps> = ({ ratioSnapshot }) => {
  if (!ratioSnapshot) {
    return (
      <div className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle text-[#57534E] text-sm">
        Loading dispute metrics...
      </div>
    );
  }

  const ratioPercent = (ratioSnapshot.ratio * 100).toFixed(2);
  const proximity = Math.min((ratioSnapshot.ratio / 0.015) * 100, 100);
  const isHighVolume = ratioSnapshot.tier === 'HIGH_VOLUME' || ratioSnapshot.ratio >= 0.015;
  const isWarningZone = ratioSnapshot.ratio >= 0.012 && !isHighVolume;

  return (
    <section className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg border bg-[#F4F1EA] text-[#0070BA] border-[#E5E0D8]">
            <ShieldExclamationIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1C1917] flex items-center gap-2">
              1.5% Dispute Ratio Shield & Radar
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#F4F1EA] text-[#57534E] border border-[#E5E0D8]">
                Rolling 90-Day
              </span>
            </h2>
            <p className="text-xs text-[#57534E] mt-0.5">
              Monitors PayPal High Volume Dispute Fee tier threshold ($30 non-refundable penalty)
            </p>
          </div>
        </div>

        {/* Tier Badge - solid 3-color styling */}
        <div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold border ${
              isHighVolume
                ? 'bg-[#1C1917] text-white border-[#1C1917]'
                : isWarningZone
                ? 'bg-[#F4F1EA] text-[#0070BA] border-[#0070BA]/40'
                : 'bg-[#F4F1EA] text-[#1C1917] border-[#E5E0D8]'
            }`}
          >
            {isHighVolume
              ? 'HIGH VOLUME TIER ($30 / claim)'
              : isWarningZone
              ? 'WARNING ZONE (Near 1.5%)'
              : 'STANDARD TIER ($15 waived on win)'}
          </span>
        </div>
      </div>

      {/* Main Gauge Visual */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Metric 1: Ratio with Progress Bar */}
        <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3.5">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-xs font-semibold text-[#57534E]">Current Dispute Ratio</span>
            <span className="text-lg font-bold font-mono text-[#1C1917]">
              {ratioPercent}%
            </span>
          </div>

          {/* Progress bar - solid accent color, no gradients */}
          <div className="w-full bg-[#E5E0D8] rounded-lg h-2.5 mb-2 overflow-hidden">
            <div
              className="h-full rounded-lg bg-[#0070BA] transition-all duration-500"
              style={{ width: `${Math.min(proximity, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[10px] text-[#57534E] font-medium">
            <span>0.0%</span>
            <span className="font-semibold text-[#0070BA]">1.25% (Alert)</span>
            <span className="font-bold text-[#1C1917]">1.50% (Cliff)</span>
          </div>
        </div>

        {/* Metric 2: 90-Day Volume */}
        <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3.5 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-[#57534E]">Rolling 90-Day Volume</span>
            <ArrowTrendingUpIcon className="w-4 h-4 text-[#0070BA]" />
          </div>
          <div className="my-1 flex items-baseline space-x-2">
            <span className="text-xl font-bold text-[#1C1917] font-mono">{ratioSnapshot.totalSales90d}</span>
            <span className="text-xs text-[#57534E]">Sales Transactions</span>
          </div>
          <div className="text-xs text-[#57534E] flex justify-between border-t border-[#E5E0D8] pt-1 mt-1">
            <span>Open/Closed Disputes:</span>
            <span className="font-semibold text-[#1C1917] font-mono">{ratioSnapshot.totalDisputes90d}</span>
          </div>
        </div>

        {/* Metric 3: Fee Cliff Economics */}
        <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3.5 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-[#57534E]">Fee Exposure Per Dispute</span>
            <CurrencyDollarIcon className="w-4 h-4 text-[#0070BA]" />
          </div>
          <div className="my-1 space-y-1">
            <div className="text-xs font-semibold text-[#0070BA] flex items-center gap-1.5">
              <CheckCircleIcon className="w-3.5 h-3.5 text-[#0070BA] flex-shrink-0" />
              Pre-Escalation Make-Offer: $0 Fee
            </div>
            <div className={`text-xs ${isHighVolume ? 'text-[#1C1917] font-bold' : 'text-[#57534E]'}`}>
              Escalated Claim Fee: {isHighVolume ? '$30.00 Non-Refundable' : '$15.00 (Refunded on Win)'}
            </div>
          </div>
          <div className="text-[11px] text-[#57534E] font-mono border-t border-[#E5E0D8] pt-1 mt-1">
            {isHighVolume
              ? 'High Volume Penalty ACTIVE — fee charged even on win'
              : 'Aegis Active: Auto-settle before escalation saves $30 fee'}
          </div>
        </div>
      </div>

      {/* Advisory Alert */}
      {isWarningZone && (
        <div className="bg-[#F4F1EA] border border-[#E5E0D8] rounded-lg p-3 flex items-start space-x-3 text-xs text-[#1C1917]">
          <ExclamationCircleIcon className="w-4 h-4 text-[#0070BA] flex-shrink-0 mt-0.5" />
          <span>
            <strong>Proximity Warning:</strong> Dispute ratio is at {ratioPercent}% (close to 1.5% limit). Aegis Dispute Shield recommends routing inquiries directly to Branch A (pre-escalation make-offer at $0 fee) to prevent crossing into the $30 High Volume penalty tier.
          </span>
        </div>
      )}
    </section>
  );
};

export default DisputeRatioRadar;
