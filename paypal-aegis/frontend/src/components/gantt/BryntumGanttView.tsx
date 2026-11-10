import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, AlertTriangle, CalendarCheck } from 'lucide-react';
import type { Milestone, PayPalDispute } from '../../types';

interface BryntumGanttViewProps {
  milestones: Milestone[];
  disputes: PayPalDispute[];
}

export const BryntumGanttView: React.FC<BryntumGanttViewProps> = ({
  milestones,
  disputes,
}) => {
  const [activeTab, setActiveTab] = useState<'GANTT' | 'CALENDAR'>('GANTT');

  return (
    <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 sm:p-8 shadow-card">
      {/* Header & View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#0070BA] shrink-0">
            <CalendarIcon className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#0F172A] leading-[1.5]">
                Bryntum Gantt & Calendar Operating View
              </h2>
              <span className="h-6 px-2 rounded-lg text-xs font-medium bg-[#F1F5F9] text-[#4B5563] border border-[#E2E8F0] inline-flex items-center">
                Payment-Driven Shifting
              </span>
            </div>
            <p className="text-sm font-normal text-[#6B7280] leading-[1.6] mt-2">
              Downstream phases automatically lock or shift when authorization holds fail; 10-day dispute deadlines mapped in real-time
            </p>
          </div>
        </div>

        {/* Segmented Tab Switch */}
        <div className="inline-flex bg-[#F1F5F9] p-2 gap-2 rounded-lg border border-[#E2E8F0] shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('GANTT')}
            className={`h-8 px-4 text-xs rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070BA] ${
              activeTab === 'GANTT'
                ? 'bg-white text-[#0F172A] font-bold shadow-subtle'
                : 'bg-transparent text-[#6B7280] hover:text-[#0F172A] font-medium'
            }`}
          >
            Milestone Gantt
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CALENDAR')}
            className={`h-8 px-4 text-xs rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070BA] ${
              activeTab === 'CALENDAR'
                ? 'bg-white text-[#0F172A] font-bold shadow-subtle'
                : 'bg-transparent text-[#6B7280] hover:text-[#0F172A] font-medium'
            }`}
          >
            10-Day Dispute Calendar
          </button>
        </div>
      </div>

      {activeTab === 'GANTT' ? (
        milestones.length === 0 ? (
          <div className="bg-[#F8FAFC] border border-dashed border-[#E2E8F0] rounded-xl p-8 flex flex-col items-center justify-center text-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center text-[#0070BA] mb-2">
              <CalendarIcon className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <p className="text-sm font-bold text-[#0F172A] leading-[1.5]">
              No milestone timeline scheduled
            </p>
            <p className="text-sm font-normal text-[#6B7280] max-w-md leading-[1.6]">
              Seed a contract in the Judge Demo toolbar above to map milestone phases and payment-driven dependencies.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Aligned Column Headers */}
            <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center px-6 pb-2 border-b border-[#E2E8F0] text-xs font-medium text-[#6B7280] leading-[1.5]">
              <div className="col-span-5">Milestone / Deliverable Phase</div>
              <div className="col-span-4 grid grid-cols-3 text-center">
                <span>Day 1–5</span>
                <span>Day 6–14</span>
                <span>Day 15–28</span>
              </div>
              <div className="col-span-3 text-right">Payment Hold State</div>
            </div>

            {milestones.map((m, idx) => {
              const isAuthorized = m.status === 'AUTHORIZED' || m.status === 'REAUTHORIZED';
              const isCaptured = m.status === 'CAPTURED';
              const isVerified = m.status === 'VERIFIED';
              const isBlocked = idx > 0 && milestones[idx - 1].status !== 'CAPTURED';

              return (
                <div
                  key={m.id}
                  className={`p-6 rounded-xl border transition-all duration-200 ${
                    isCaptured
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : isAuthorized
                      ? 'bg-blue-50/40 border-blue-200'
                      : isBlocked
                      ? 'bg-[#F8FAFC] border-[#E2E8F0] opacity-80'
                      : 'bg-[#F8FAFC] border-[#E2E8F0]'
                  }`}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                    {/* Phase Details */}
                    <div className="lg:col-span-5 flex items-start gap-4 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isCaptured
                            ? 'bg-emerald-600 text-white'
                            : isAuthorized
                            ? 'bg-[#0070BA] text-white'
                            : isBlocked
                            ? 'bg-[#F1F5F9] text-[#6B7280] border border-[#E2E8F0]'
                            : 'bg-[#0070BA] text-white'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-[#0F172A] leading-[1.5] flex flex-wrap items-center gap-2">
                          <span>{m.name}</span>
                          {m.dependencies.length > 0 && (
                            <span className="text-xs font-normal text-[#6B7280]">
                              (Depends on Phase {idx})
                            </span>
                          )}
                        </h4>
                        <p className="text-sm font-normal text-[#6B7280] leading-[1.6] mt-2">
                          {m.description}
                        </p>
                      </div>
                    </div>

                    {/* Gantt Progress Bar */}
                    <div className="lg:col-span-4">
                      <div className="w-full bg-[#E2E8F0] rounded-lg h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-lg transition-all duration-200 ${
                            isCaptured
                              ? 'w-full bg-emerald-600'
                              : isVerified
                              ? 'w-3/4 bg-[#0070BA]'
                              : isAuthorized
                              ? 'w-1/2 bg-[#0070BA]'
                              : isBlocked
                              ? 'w-0 bg-slate-400'
                              : 'w-1/4 bg-slate-500'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Amount & Hold Status */}
                    <div className="lg:col-span-3 flex flex-row lg:flex-col items-center lg:items-end justify-between gap-2">
                      <span className="text-sm font-bold text-[#0F172A] tabular-nums leading-[1.5]">
                        ${m.amount.value} {m.amount.currency_code}
                      </span>
                      <span
                        className={`h-6 px-2 rounded-lg text-xs font-medium uppercase border inline-flex items-center ${
                          isCaptured
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : isAuthorized
                            ? 'bg-blue-50 text-[#003087] border-blue-200'
                            : isBlocked
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-[#F1F5F9] text-[#4B5563] border-[#E2E8F0]'
                        }`}
                      >
                        {isBlocked ? 'Shifted: Awaiting Capture' : m.status}
                      </span>
                    </div>
                  </div>

                  {/* Day-3 Reauthorization Sub-Banner */}
                  {m.status === 'REAUTHORIZED' && (
                    <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-xs leading-[1.5] tabular-nums">
                      <span className="inline-flex items-center gap-2 font-medium text-[#003087]">
                        <Clock className="w-4 h-4 text-[#0070BA] shrink-0" strokeWidth={1.75} />
                        Day-3 Reauthorization Extended: Active Pointer {m.activeAuthorizationId}
                      </span>
                      <span className="font-normal text-[#6B7280]">
                        Previous ID: {m.originalAuthorizationId} (Superseded)
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Calendar View: 10-day dispute deadlines & 72h honor period */
        <div className="space-y-4">
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4 text-sm text-[#0F172A] leading-[1.6] flex items-start gap-4">
            <Clock className="w-5 h-5 text-[#0070BA] shrink-0" strokeWidth={1.75} />
            <span>
              <strong className="font-bold">Bryntum Calendar Timeline:</strong> Tracks PayPal
              10-day seller response deadlines (seller_response_due_date) and 72-hour authorization
              honor periods to guarantee zero missed representment windows.
            </span>
          </div>

          {disputes.length === 0 ? (
            <div className="bg-[#F8FAFC] border border-dashed border-[#E2E8F0] rounded-xl p-8 flex flex-col items-center justify-center text-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center text-emerald-700 mb-2">
                <CalendarCheck className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <p className="text-sm font-bold text-[#0F172A] leading-[1.5]">
                No open disputes on calendar
              </p>
              <p className="text-sm font-normal text-[#6B7280] max-w-md leading-[1.6]">
                All transaction windows are clear. Use Judge Demo Fixture 4 to simulate a SNAD dispute deadline.
              </p>
            </div>
          ) : (
            disputes.map((d) => {
              const dueDate = d.seller_response_due_date
                ? new Date(d.seller_response_due_date)
                : null;
              const formattedDue = dueDate ? dueDate.toLocaleDateString() : 'In 10 Days';

              return (
                <div
                  key={d.dispute_id}
                  className="bg-red-50/60 border border-red-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-800 font-bold text-xs shrink-0 tabular-nums">
                      10d
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] leading-[1.5] flex flex-wrap items-center gap-2">
                        <span>
                          Dispute {d.dispute_id} — {d.reason}
                        </span>
                        <span className="h-6 px-2 rounded-lg text-xs font-medium bg-red-100 text-red-800 border border-red-200 inline-flex items-center">
                          {d.dispute_life_cycle_stage}
                        </span>
                      </h4>
                      <p className="text-sm font-normal text-[#6B7280] leading-[1.6] mt-2 tabular-nums">
                        Disputed Amount: ${d.dispute_amount.value} {d.dispute_amount.currency_code} •
                        Channel: {d.dispute_channel}
                      </p>
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0 space-y-2">
                    <div className="text-sm font-bold text-red-800 flex items-center sm:justify-end gap-2 leading-[1.5] tabular-nums">
                      <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" strokeWidth={1.75} />
                      <span>Response Deadline: {formattedDue}</span>
                    </div>
                    <span className="text-xs font-normal text-[#6B7280] block leading-[1.5]">
                      Aegis Auto-Representment Staged in HITL
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
};

export default BryntumGanttView;
