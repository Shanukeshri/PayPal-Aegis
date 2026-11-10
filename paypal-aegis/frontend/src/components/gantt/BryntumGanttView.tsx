import React, { useState } from 'react';
import {
  CalendarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
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
    <section className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle">
      {/* Header and Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-[#F4F1EA] text-[#0070BA] border border-[#E5E0D8]">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1C1917] flex items-center gap-2">
              Bryntum Gantt & Calendar Operating View
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#F4F1EA] text-[#57534E] border border-[#E5E0D8]">
                Payment-Driven Shifting
              </span>
            </h2>
            <p className="text-xs text-[#57534E] mt-0.5">
              Downstream phases automatically lock or shift when authorization holds fail; 10-day dispute deadlines mapped in real-time
            </p>
          </div>
        </div>

        {/* Tab switcher - solid 3-color palette, no gradients */}
        <div className="flex bg-[#F4F1EA] p-1 rounded-lg border border-[#E5E0D8]">
          <button
            onClick={() => setActiveTab('GANTT')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
              activeTab === 'GANTT'
                ? 'bg-[#0070BA] text-white shadow-subtle'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Milestone Gantt
          </button>
          <button
            onClick={() => setActiveTab('CALENDAR')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
              activeTab === 'CALENDAR'
                ? 'bg-[#0070BA] text-white shadow-subtle'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            10-Day Dispute Calendar
          </button>
        </div>
      </div>

      {activeTab === 'GANTT' ? (
        /* Gantt View */
        <div className="space-y-3.5">
          <div className="text-xs text-[#57534E] flex items-center justify-between border-b border-[#E5E0D8] pb-2.5 font-mono">
            <span>Milestone / Deliverable Phase</span>
            <div className="flex space-x-8">
              <span>Day 1–5</span>
              <span>Day 6–14</span>
              <span>Day 15–28</span>
              <span>Payment Hold State</span>
            </div>
          </div>

          {milestones.map((m, idx) => {
            const isAuthorized = m.status === 'AUTHORIZED' || m.status === 'REAUTHORIZED';
            const isCaptured = m.status === 'CAPTURED';
            const isVerified = m.status === 'VERIFIED';
            const isBlocked = idx > 0 && milestones[idx - 1].status !== 'CAPTURED';

            return (
              <div
                key={m.id}
                className="p-3.5 rounded-lg border transition-colors bg-[#F9F8F5] border-[#E5E0D8]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isCaptured || isAuthorized || isVerified
                          ? 'bg-[#0070BA] text-white'
                          : 'bg-[#F4F1EA] text-[#57534E] border border-[#E5E0D8]'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#1C1917] flex items-center gap-2">
                        {m.name}
                        {m.dependencies.length > 0 && (
                          <span className="text-[11px] text-[#57534E] font-mono">
                            (Depends on Phase {idx})
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-[#57534E] mt-0.5">{m.description}</p>
                    </div>
                  </div>

                  {/* Gantt Bar Visualization */}
                  <div className="flex items-center space-x-4">
                    {/* Visual Progress Bar - solid accent, no gradients */}
                    <div className="w-48 bg-[#E5E0D8] rounded-lg h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-lg bg-[#0070BA] transition-all duration-700 ${
                          isCaptured
                            ? 'w-full'
                            : isVerified
                            ? 'w-3/4'
                            : isAuthorized
                            ? 'w-1/2'
                            : isBlocked
                            ? 'w-0'
                            : 'w-1/4'
                        }`}
                      ></div>
                    </div>

                    {/* Milestone Amount & Badge */}
                    <div className="text-right min-w-[130px]">
                      <span className="text-xs font-mono font-bold text-[#1C1917] block">
                        ${m.amount.value} {m.amount.currency_code}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md border mt-0.5 inline-block ${
                          isCaptured || isAuthorized
                            ? 'bg-[#F4F1EA] text-[#0070BA] border-[#0070BA]/40'
                            : 'bg-white text-[#57534E] border-[#E5E0D8]'
                        }`}
                      >
                        {isBlocked ? 'Shifted: Awaiting Capture' : m.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Day-3 Reauth Banner if active */}
                {m.status === 'REAUTHORIZED' && (
                  <div className="mt-2.5 pt-2 border-t border-[#E5E0D8] flex items-center justify-between text-xs text-[#0070BA] font-mono">
                    <span className="flex items-center gap-1.5">
                      <ClockIcon className="w-3.5 h-3.5 text-[#0070BA]" />
                      Day-3 Reauthorization Extended: Active Pointer {m.activeAuthorizationId}
                    </span>
                    <span className="text-[#57534E]">
                      Previous ID: {m.originalAuthorizationId} (Superseded)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Calendar View: 10-day dispute deadlines & 72h honor period */
        <div className="space-y-3">
          <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3 text-xs text-[#1C1917] flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-[#0070BA] flex-shrink-0" />
            <span>
              <strong>Bryntum Calendar Timeline:</strong> Tracks PayPal 10-day seller response deadlines (`seller_response_due_date`) and 72-hour authorization honor periods to guarantee zero missed representment windows.
            </span>
          </div>

          {disputes.length === 0 ? (
            <div className="text-center py-8 text-[#57534E] text-xs border border-dashed border-[#E5E0D8] rounded-lg">
              No open disputes currently tracked on the calendar. Use Judge Demo Button 4 to simulate a dispute event.
            </div>
          ) : (
            disputes.map((d) => {
              const dueDate = d.seller_response_due_date ? new Date(d.seller_response_due_date) : null;
              const formattedDue = dueDate ? dueDate.toLocaleDateString() : 'In 10 Days';

              return (
                <div
                  key={d.dispute_id}
                  className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-[#F4F1EA] border border-[#E5E0D8] flex items-center justify-center text-[#1C1917] font-bold text-xs">
                      10d
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
                        Dispute {d.dispute_id} — {d.reason}
                        <span className="text-[10px] bg-[#F4F1EA] text-[#57534E] border border-[#E5E0D8] px-2 py-0.5 rounded-md font-mono">
                          {d.dispute_life_cycle_stage}
                        </span>
                      </h4>
                      <p className="text-xs text-[#57534E] mt-0.5">
                        Disputed Amount: ${d.dispute_amount.value} {d.dispute_amount.currency_code} • Channel: {d.dispute_channel}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-semibold text-[#1C1917] flex items-center justify-end gap-1.5">
                      <ExclamationTriangleIcon className="w-3.5 h-3.5 text-[#0070BA]" />
                      Response Deadline: {formattedDue}
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-1">
                      <a
                        href={`http://localhost:3001/api/disputes/${d.dispute_id}/evidence-pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-0.5 text-[11px] bg-white hover:bg-[#F4F1EA] text-[#0070BA] border border-[#0070BA]/40 rounded flex items-center gap-1 font-semibold transition"
                      >
                        <DocumentTextIcon className="w-3 h-3 text-[#0070BA]" />
                        Preview Auto-Compiled Evidence PDF
                      </a>
                    </div>
                    <span className="text-[11px] text-[#57534E] font-mono block mt-0.5">
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
