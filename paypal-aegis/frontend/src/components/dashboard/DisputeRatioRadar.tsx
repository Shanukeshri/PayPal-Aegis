import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  CheckCircle,
} from 'lucide-react';
import type { DisputeRatioSnapshot } from '../../types';

interface DisputeRatioRadarProps {
  ratioSnapshot: DisputeRatioSnapshot | null;
}

export const DisputeRatioRadar: React.FC<DisputeRatioRadarProps> = ({ ratioSnapshot }) => {
  if (!ratioSnapshot) {
    return (
      <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 sm:p-8 shadow-card">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#0070BA] shrink-0">
            <ShieldAlert className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#0F172A] leading-[1.5]">
                1.5% Dispute Ratio Shield & Radar
              </h2>
              <span className="h-6 px-2 rounded-lg text-xs font-medium bg-[#F1F5F9] text-[#4B5563] border border-[#E2E8F0] inline-flex items-center">
                Rolling 90-Day
              </span>
            </div>
            <p className="text-sm font-normal text-[#6B7280] leading-[1.6] mt-2">
              Monitors PayPal High Volume Dispute Fee tier threshold ($30 non-refundable penalty)
            </p>
          </div>
        </div>

        <div className="bg-[#F8FAFC] border border-dashed border-[#E2E8F0] rounded-xl p-8 flex flex-col items-center justify-center text-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center text-[#6B7280] mb-2">
            <TrendingUp className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <p className="text-sm font-bold text-[#0F172A] leading-[1.5]">
            Loading dispute compliance metrics
          </p>
          <p className="text-sm font-normal text-[#6B7280] max-w-md leading-[1.6]">
            Synchronizing rolling 90-day transaction volume and dispute tier telemetry with SafeGate.
          </p>
        </div>
      </section>
    );
  }

  const ratioPercent = (ratioSnapshot.ratio * 100).toFixed(2);
  const proximity = Math.min((ratioSnapshot.ratio / 0.015) * 100, 100);
  const isHighVolume = ratioSnapshot.tier === 'HIGH_VOLUME' || ratioSnapshot.ratio >= 0.015;
  const isWarningZone = ratioSnapshot.ratio >= 0.012 && !isHighVolume;

  return (
    <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 sm:p-8 shadow-card">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
              isHighVolume
                ? 'bg-red-50 border-red-200 text-red-700'
                : isWarningZone
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-blue-50 border-blue-200 text-[#0070BA]'
            }`}
          >
            <ShieldAlert className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#0F172A] leading-[1.5]">
                1.5% Dispute Ratio Shield & Radar
              </h2>
              <span className="h-6 px-2 rounded-lg text-xs font-medium bg-[#F1F5F9] text-[#4B5563] border border-[#E2E8F0] inline-flex items-center">
                Rolling 90-Day
              </span>
            </div>
            <p className="text-sm font-normal text-[#6B7280] leading-[1.6] mt-2">
              Monitors PayPal High Volume Dispute Fee tier threshold ($30 non-refundable penalty)
            </p>
          </div>
        </div>

        {/* Tier Status Badge */}
        <div className="shrink-0">
          <span
            className={`inline-flex items-center h-8 px-4 rounded-lg text-xs font-bold border ${
              isHighVolume
                ? 'bg-red-50 text-red-800 border-red-200'
                : isWarningZone
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
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

      {/* 3-Column Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1: Ratio with Progress Bar */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-6 flex flex-col justify-between gap-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wider leading-[1.5]">
              Current Dispute Ratio
            </span>
            <span
              className={`text-2xl font-bold tabular-nums leading-[1.25] ${
                isHighVolume
                  ? 'text-red-700'
                  : isWarningZone
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {ratioPercent}%
            </span>
          </div>

          <div className="w-full bg-[#E2E8F0] rounded-lg h-2 overflow-hidden">
            <div
              className={`h-2 rounded-lg transition-all duration-200 ${
                isHighVolume
                  ? 'bg-red-600'
                  : isWarningZone
                  ? 'bg-amber-600'
                  : 'bg-[#0070BA]'
              }`}
              style={{ width: `${Math.min(proximity, 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-xs font-medium tabular-nums leading-[1.5]">
            <span className="text-[#6B7280]">0.0%</span>
            <span className="text-amber-800">1.25% (Alert)</span>
            <span className="text-red-800 font-bold">1.50% (Cliff)</span>
          </div>
        </div>

        {/* Metric 2: 90-Day Volume */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wider leading-[1.5]">
              Rolling 90-Day Volume
            </span>
            <TrendingUp className="w-4 h-4 text-[#0070BA]" strokeWidth={1.75} />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#0F172A] tabular-nums leading-[1.25]">
              {ratioSnapshot.totalSales90d}
            </span>
            <span className="text-sm font-normal text-[#6B7280] leading-[1.6]">
              Sales Transactions
            </span>
          </div>

          <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs leading-[1.5]">
            <span className="text-[#6B7280] font-normal">Open / Closed Disputes</span>
            <span className="font-bold text-[#0F172A] tabular-nums">
              {ratioSnapshot.totalDisputes90d}
            </span>
          </div>
        </div>

        {/* Metric 3: Fee Cliff Economics */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wider leading-[1.5]">
              Fee Exposure Per Dispute
            </span>
            <DollarSign className="w-4 h-4 text-emerald-700" strokeWidth={1.75} />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-emerald-800 flex items-center gap-2 leading-[1.5]">
              <CheckCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span>Pre-Escalation Make-Offer: $0 Fee</span>
            </div>
            <div
              className={`text-xs leading-[1.5] ${
                isHighVolume ? 'text-red-800 font-bold' : 'text-[#6B7280] font-normal'
              }`}
            >
              Escalated Claim Fee:{' '}
              {isHighVolume ? '$30.00 Non-Refundable' : '$15.00 (Refunded on Win)'}
            </div>
          </div>

          <div
            className={`pt-2 border-t border-[#E2E8F0] text-xs font-medium flex items-center gap-2 leading-[1.5] ${
              isHighVolume ? 'text-red-800' : 'text-[#003087]'
            }`}
          >
            {isHighVolume ? (
              <>
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-700" strokeWidth={1.75} />
                <span>High Volume Penalty ACTIVE — fees charged on win</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 shrink-0 text-[#0070BA]" strokeWidth={1.75} />
                <span>Aegis Active: Auto-settle before escalation saves $30</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Advisory Alert */}
      {isWarningZone && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-4 text-sm text-amber-900 leading-[1.6]">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" strokeWidth={1.75} />
          <span>
            <strong className="font-bold">Proximity Warning:</strong> Dispute ratio is at{' '}
            {ratioPercent}% (close to 1.5% limit). Aegis Dispute Shield recommends routing inquiries
            directly to Branch A (pre-escalation make-offer at $0 fee) to prevent crossing into the
            $30 High Volume penalty tier.
          </span>
        </div>
      )}
    </section>
  );
};

export default DisputeRatioRadar;
