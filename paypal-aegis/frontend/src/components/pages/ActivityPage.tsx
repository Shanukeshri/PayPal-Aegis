import React, { useMemo, useState } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import type { EcosystemEvent, EcosystemActor } from '../../types';
import { formatShortTime } from '../../lib/workflow';

interface ActivityPageProps {
  events: EcosystemEvent[];
}

type FilterMode = 'ALL' | 'CLIENT' | 'BUSINESS' | 'PAYPAL_ENGINE';

function actorLabel(actor: EcosystemActor | 'ALL') {
  if (actor === 'CLIENT') return 'Client';
  if (actor === 'BUSINESS') return 'Merchant';
  if (actor === 'PAYPAL_ENGINE') return 'PayPal';
  return 'All';
}

export const ActivityPage: React.FC<ActivityPageProps> = ({ events }) => {
  const [filter, setFilter] = useState<FilterMode>('ALL');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const counts = useMemo(() => {
    return {
      ALL: events.length,
      CLIENT: events.filter(
        (e) => e.sender === 'CLIENT' || e.recipient === 'CLIENT' || e.recipient === 'ALL'
      ).length,
      BUSINESS: events.filter(
        (e) => e.sender === 'BUSINESS' || e.recipient === 'BUSINESS' || e.recipient === 'ALL'
      ).length,
      PAYPAL_ENGINE: events.filter(
        (e) =>
          e.sender === 'PAYPAL_ENGINE' ||
          e.recipient === 'PAYPAL_ENGINE' ||
          e.recipient === 'ALL'
      ).length,
    };
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (filter === 'ALL') return events;
    return events.filter(
      (e) => e.sender === filter || e.recipient === filter || e.recipient === 'ALL'
    );
  }, [events, filter]);

  const toggleDetails = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const chips: Array<{ key: FilterMode; label: string }> = [
    { key: 'ALL', label: 'All' },
    { key: 'CLIENT', label: 'Client' },
    { key: 'BUSINESS', label: 'Merchant' },
    { key: 'PAYPAL_ENGINE', label: 'PayPal' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#1C1917] tracking-tight">Activity</h1>
          <p className="text-xs text-[#57534E] mt-0.5">
            Cross-party event history across Client, Merchant, and PayPal Aegis.
          </p>
        </div>

        {/* Filter Chips: All | Client | Merchant | PayPal */}
        <div className="inline-flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => {
            const active = filter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(chip.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  active
                    ? 'bg-[#0070BA] text-white border-[#0070BA]'
                    : 'bg-white text-[#57534E] border-[#E5E0D8] hover:text-[#1C1917]'
                }`}
              >
                <span>{chip.label}</span>
                {counts[chip.key] > 0 && (
                  <span
                    className={`text-[10px] font-mono px-1.5 rounded-full ${
                      active ? 'bg-white/20 text-white' : 'bg-[#F4F1EA] text-[#1C1917]'
                    }`}
                  >
                    {counts[chip.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Event List */}
      <div className="bg-white border border-[#E5E0D8] rounded-xl shadow-subtle overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#78716C]">
            No activity recorded for this filter yet.
          </div>
        ) : (
          <ul className="divide-y divide-[#E5E0D8]">
            {filteredEvents.map((ev) => {
              const isExpanded = Boolean(expandedIds[ev.id]);
              const hasPayload = ev.payload && Object.keys(ev.payload).length > 0;

              return (
                <li key={ev.id} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-semibold text-[#1C1917]">
                          {actorLabel(ev.sender)}
                        </span>
                        <ArrowRightIcon className="w-3 h-3 text-[#0070BA]" />
                        <span className="font-semibold text-[#1C1917]">
                          {actorLabel(ev.recipient)}
                        </span>
                        <span className="text-[#78716C]">·</span>
                        <span className="font-semibold text-[#0070BA]">{ev.title}</span>
                      </div>
                      <p className="text-xs text-[#57534E] leading-relaxed">{ev.message}</p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[11px] font-mono text-[#78716C]">
                        {formatShortTime(ev.timestamp)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleDetails(ev.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-[#57534E] hover:text-[#1C1917] bg-[#F9F8F5] border border-[#E5E0D8]"
                      >
                        <span>Details</span>
                        {isExpanded ? (
                          <ChevronUpIcon className="w-3 h-3" />
                        ) : (
                          <ChevronDownIcon className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg p-3 text-[11px] font-mono space-y-1.5">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[#57534E]">
                        <span>
                          Event: <strong className="text-[#1C1917]">{ev.eventType}</strong>
                        </span>
                        <span>
                          Agent: <strong className="text-[#1C1917]">{ev.agentName}</strong>
                        </span>
                      </div>
                      {hasPayload && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 border-t border-[#E5E0D8]">
                          {Object.entries(ev.payload || {}).map(([k, v]) => (
                            <div key={k} className="truncate">
                              <span className="text-[#78716C]">{k}: </span>
                              <span className="text-[#1C1917] font-semibold">
                                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ActivityPage;

