import React, { useState, useMemo } from 'react';
import {
  BellAlertIcon,
  ArrowRightIcon,
  CpuChipIcon,
  UserCircleIcon,
  BuildingOffice2Icon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import type { EcosystemEvent, EcosystemActor } from '../../types';

interface CrossPartyNotificationCenterProps {
  events: EcosystemEvent[];
}

type FilterMode = 'ALL' | 'CLIENT' | 'BUSINESS' | 'PAYPAL_ENGINE';

function actorMeta(actor: EcosystemActor | 'ALL') {
  switch (actor) {
    case 'CLIENT':
      return {
        label: '👤 Client',
        full: '👤 Client (Acme Global)',
        badgeCls: 'bg-purple-50 text-purple-800 border-purple-200',
      };
    case 'BUSINESS':
      return {
        label: '🏢 Merchant',
        full: '🏢 Merchant (Aegis Studio)',
        badgeCls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    case 'PAYPAL_ENGINE':
      return {
        label: '⚡ PayPal',
        full: '⚡ PayPal Ledger',
        badgeCls: 'bg-[#E6F2FA] text-[#0070BA] border-[#0070BA]/30',
      };
    default:
      return {
        label: '🌐 All Actors',
        full: '🌐 Client & Business',
        badgeCls: 'bg-[#F4F1EA] text-[#1C1917] border-[#E5E0D8]',
      };
  }
}

export const CrossPartyNotificationCenter: React.FC<CrossPartyNotificationCenterProps> = ({
  events,
}) => {
  const [filter, setFilter] = useState<FilterMode>('ALL');

  const counts = useMemo(() => {
    const clientCount = events.filter(
      (e) => e.sender === 'CLIENT' || e.recipient === 'CLIENT' || e.recipient === 'ALL'
    ).length;
    const merchantCount = events.filter(
      (e) => e.sender === 'BUSINESS' || e.recipient === 'BUSINESS' || e.recipient === 'ALL'
    ).length;
    const paypalCount = events.filter(
      (e) => e.sender === 'PAYPAL_ENGINE' || e.recipient === 'PAYPAL_ENGINE' || e.recipient === 'ALL'
    ).length;
    return {
      ALL: events.length,
      CLIENT: clientCount,
      BUSINESS: merchantCount,
      PAYPAL_ENGINE: paypalCount,
    };
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (filter === 'ALL') return events;
    return events.filter(
      (e) => e.sender === filter || e.recipient === filter || e.recipient === 'ALL'
    );
  }, [events, filter]);

  const filterButtons: Array<{
    key: FilterMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: 'ALL', label: 'All Events', icon: BellAlertIcon },
    { key: 'CLIENT', label: '👤 Client Inbox', icon: UserCircleIcon },
    { key: 'BUSINESS', label: '🏢 Merchant Alerts', icon: BuildingOffice2Icon },
    { key: 'PAYPAL_ENGINE', label: '⚡ PayPal Ledger', icon: BoltIcon },
  ];

  return (
    <section
      aria-label="Cross-Party Notification and Activity Bus"
      className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle space-y-4"
    >
      {/* Header & Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E5E0D8]">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-[#E6F2FA] text-[#0070BA] border border-[#0070BA]/20">
            <BellAlertIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#1C1917] flex items-center gap-2">
              Cross-Party Notification &amp; Activity Bus
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                Persistent Actor Attribution
              </span>
            </h2>
            <p className="text-xs text-[#57534E]">
              Every notification raised across Client, Business, and PayPal Aegis Engine is tracked in real time with sender, receiver, agent broker, and financial payload.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#F4F1EA] p-1 rounded-xl border border-[#E5E0D8]">
          {filterButtons.map((btn) => {
            const isActive = filter === btn.key;
            return (
              <button
                key={btn.key}
                type="button"
                onClick={() => setFilter(btn.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  isActive
                    ? 'bg-[#0070BA] text-white shadow-subtle'
                    : 'text-[#57534E] hover:text-[#1C1917] hover:bg-white/70'
                }`}
              >
                <span>{btn.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-[#1C1917] border border-[#E5E0D8]'
                  }`}
                >
                  {counts[btn.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Event Stream List */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-8 text-xs text-[#57534E] border border-dashed border-[#E5E0D8] rounded-xl bg-[#F9F8F5]">
          No cross-party notifications recorded yet. Execute a workflow step or click a Client/Merchant action to watch notifications propagate live.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
          {filteredEvents.map((evt, index) => {
            const sender = actorMeta(evt.sender);
            const recipient = actorMeta(evt.recipient);
            const isNewest = index === 0;
            const timeStr = new Date(evt.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div
                key={evt.id}
                className={`rounded-xl border p-3.5 transition-all ${
                  isNewest
                    ? 'bg-[#E6F2FA]/30 border-[#0070BA]/40 ring-1 ring-[#0070BA]/15'
                    : 'bg-[#F9F8F5] border-[#E5E0D8]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] font-bold text-[#78716C] bg-white px-2 py-0.5 rounded border border-[#E5E0D8]">
                      [{timeStr}]
                    </span>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${sender.badgeCls}`}>
                      {sender.label}
                    </span>

                    <ArrowRightIcon className="w-3 h-3 text-[#0070BA]" />

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${recipient.badgeCls}`}>
                      {recipient.label}
                    </span>

                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-[#57534E] bg-white px-2 py-0.5 rounded border border-[#E5E0D8]">
                      <CpuChipIcon className="w-3 h-3 text-[#0070BA]" />
                      Brokered by: {evt.agentName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isNewest && (
                      <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#0070BA] text-white animate-pulse">
                        LIVE
                      </span>
                    )}
                    <span className="text-[10px] font-mono font-semibold text-[#57534E] uppercase">
                      {evt.eventType}
                    </span>
                  </div>
                </div>

                <h4 className="text-xs font-bold text-[#1C1917]">{evt.title}</h4>
                <p className="text-xs text-[#57534E] mt-0.5 leading-relaxed">{evt.message}</p>

                {evt.payload && Object.keys(evt.payload).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(evt.payload).slice(0, 5).map(([k, v]) => (
                      <span
                        key={k}
                        className="text-[10px] font-mono bg-white text-[#1C1917] px-2 py-0.5 rounded border border-[#E5E0D8]"
                      >
                        <span className="text-[#78716C]">{k}:</span>{' '}
                        <span className="font-semibold">
                          {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default CrossPartyNotificationCenter;

