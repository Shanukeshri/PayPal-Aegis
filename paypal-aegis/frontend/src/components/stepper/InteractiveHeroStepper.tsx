import React from 'react';
import {
  DocumentTextIcon,
  ClockIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  ForwardIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

export type StepId = 1 | 2 | 3 | 4;
export type StepStatus = 'IDLE' | 'IN_FLIGHT' | 'SUCCESS';

export interface StepExecutionInfo {
  status: StepStatus;
  statusCode?: number;
  latencyMs?: number;
  lastExecutedAt?: string;
  summary?: string;
}

interface InteractiveHeroStepperProps {
  currentStage: StepId;
  executingStep: StepId | null;
  stepStatusMap: Record<StepId, StepExecutionInfo>;
  onExecuteStep: (stepId: StepId) => Promise<void>;
  onSelectTabOnly?: (stepId: StepId) => void;
  activeTab?: number;
}

export const InteractiveHeroStepper: React.FC<InteractiveHeroStepperProps> = ({
  currentStage,
  executingStep,
  stepStatusMap,
  onExecuteStep,
  onSelectTabOnly,
  activeTab,
}) => {
  const steps = [
    {
      id: 1 as StepId,
      title: '1. Contract Ingestion & Escrow Lock',
      badge: '[Agent: ContractParser (APIMatic Grounded)]',
      badgeType: 'AGENT',
      actionText: '1. Seed Contract & Hold',
      desc: 'Parses SOW, populates Bryntum Gantt, and calls Orders v2 (intent: "AUTHORIZE") with a 36-char UUID PayPal-Request-Id.',
      targetTab: 0, // Tab 1: Escrow & Project Timeline
      icon: DocumentTextIcon,
    },
    {
      id: 2 as StepId,
      title: '2. Day-3 Renewal & Mutated ID Rotation',
      badge: '[Engine: 72h Hold Keeper (Render Workflows)]',
      badgeType: 'ENGINE',
      actionText: '2. Fast-Forward Day-3',
      desc: 'Calls Payments v2 /reauthorize, catches the mutated authorization_id, updates the ledger pointer, and highlights the diff.',
      targetTab: 0, // Tab 1: Escrow & Project Timeline
      icon: ClockIcon,
    },
    {
      id: 3 as StepId,
      title: '3. Deliverable Audit & SafeGate HITL',
      badge: '[Agent: DeliveryAuditor (Vision + Channel3 Catalog RAG)]',
      badgeType: 'AGENT',
      actionText: '3. Verify Deliverable',
      desc: 'Executes multimodal verification (Channel3 100M+ catalog SKU match + Elastic kNN vector similarity) and pauses capture in SafeGate HITL approval.',
      targetTab: 1, // Tab 2: Deliverable Audit & SafeGate HITL
      icon: ShieldCheckIcon,
    },
    {
      id: 4 as StepId,
      title: '4. 1.5% Dispute Shield & Auto-Defense',
      badge: '[Agent: DisputeStrategist (Elastic Audit RAG + Legal PDF Compiler)]',
      badgeType: 'AGENT',
      actionText: '4. Simulate Dispute (1.42%)',
      desc: 'Computes 90-day dispute ratio, routes to Branch A ($0 fee make-offer) or executes Transactional RAG over Elastic delivery logs to compile an A4 PDF via provide-evidence.',
      targetTab: 2, // Tab 3: Dispute Defense & Revenue Shield
      icon: ExclamationTriangleIcon,
    },
  ];

  return (
    <nav
      aria-label="Workflow Execution Stepper"
      className="bg-white border-b border-[#E5E0D8] px-4 py-3 shadow-subtle relative z-30"
    >
      <div className="max-w-7xl mx-auto">
        {/* Stepper Header Meta Bar */}
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#E5E0D8]/60 text-xs text-[#57534E]">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[#1C1917] tracking-tight uppercase text-[11px] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0070BA]"></span>
              Hero Interactive Execution Stepper & Workflow Driver
            </span>
            <span className="hidden md:inline font-mono text-[10px] text-[#78716C]">
              • Click any step to execute & watch live changes across Client ⟷ PayPal ⟷ Business
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[11px] font-mono">
            <span className="text-[#78716C]">Active Pipeline:</span>
            <span className="font-bold text-[#0070BA]">
              {executingStep
                ? `Executing Stage ${executingStep}...`
                : `Stage ${currentStage} Ready`}
            </span>
          </div>
        </div>

        {/* 4 Connected Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 relative">
          {steps.map((s, idx) => {
            const isStepActive = currentStage === s.id;
            const isExecutingThis = executingStep === s.id;
            const info = stepStatusMap[s.id] || { status: 'IDLE' };
            const isSuccess = info.status === 'SUCCESS';

            return (
              <div
                key={s.id}
                onClick={() => onExecuteStep(s.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onExecuteStep(s.id);
                  }
                }}
                className={`group relative text-left rounded-xl p-3 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isExecutingThis
                    ? 'bg-[#E6F2FA]/70 border-[#0070BA] ring-2 ring-[#0070BA]/30 shadow-md'
                    : isStepActive
                    ? 'bg-[#F9F8F5] border-[#0070BA]/60 shadow-subtle ring-1 ring-[#0070BA]/20'
                    : 'bg-white border-[#E5E0D8] hover:border-[#D6D0C5] hover:bg-[#FAF9F6]'
                }`}
              >
                {/* Top Badge & Status Indicator */}
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-tight bg-[#F4F1EA] text-[#0070BA] border border-[#0070BA]/30 truncate max-w-[210px]">
                      {s.badge}
                    </span>

                    {/* Status Pill */}
                    <div>
                      {isExecutingThis ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#0070BA] text-white animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full mr-1 bg-white animate-ping" />
                          IN_FLIGHT
                        </span>
                      ) : isSuccess ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircleIcon className="w-3 h-3 mr-1 text-emerald-700" />
                          {info.statusCode || '200 OK'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F4F1EA] text-[#78716C]">
                          IDLE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xs font-bold text-[#1C1917] tracking-tight group-hover:text-[#0070BA] transition-colors leading-snug">
                    {s.title}
                  </h3>
                  <p className="text-[11px] text-[#57534E] mt-1 leading-relaxed line-clamp-2">
                    {s.desc}
                  </p>
                </div>

                {/* Bottom Action Button & Animated SVG Dots */}
                <div className="mt-3 pt-2 border-t border-[#E5E0D8]/60 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExecuteStep(s.id);
                    }}
                    disabled={isExecutingThis}
                    className={`inline-flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg shadow-subtle transition disabled:opacity-50 ${
                      isExecutingThis
                        ? 'bg-[#0070BA] text-white'
                        : isStepActive
                        ? 'bg-[#0070BA] hover:bg-[#005EA6] text-white'
                        : 'bg-white hover:bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8] group-hover:border-[#0070BA]/50'
                    }`}
                  >
                    {isExecutingThis ? (
                      <ArrowPathIcon className="w-3 h-3 animate-spin text-white" />
                    ) : s.id === 1 ? (
                      <PlayIcon className="w-3 h-3 text-current" />
                    ) : s.id === 2 ? (
                      <ForwardIcon className="w-3 h-3 text-current" />
                    ) : s.id === 3 ? (
                      <CheckCircleIcon className="w-3 h-3 text-current" />
                    ) : (
                      <ExclamationTriangleIcon className="w-3 h-3 text-current" />
                    )}
                    <span>{s.actionText}</span>
                  </button>

                  {/* Latency / Packet Flow Indicator & Optional Deep Dive Trigger */}
                  <div className="flex items-center gap-2">
                    {isExecutingThis ? (
                      <div className="flex items-center space-x-1" title="Pulsing SVG packet dots">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0070BA] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0070BA] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0070BA] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : info.latencyMs ? (
                      <span className="font-mono text-[10px] text-[#78716C]">
                        {info.latencyMs}ms
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-[#A8A29E]">
                        Updates Live
                      </span>
                    )}
                    {onSelectTabOnly && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTabOnly(s.id);
                        }}
                        title="Open deep-dive view for this stage"
                        className="text-[10px] font-mono font-bold text-[#0070BA] hover:underline"
                      >
                        Inspect →
                      </button>
                    )}
                  </div>
                </div>

                {/* Desktop Connecting Arrow between steps */}
                {idx < 3 && (
                  <div className="hidden xl:block absolute -right-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
                    <div className="w-4 h-4 rounded-full bg-white border border-[#E5E0D8] flex items-center justify-center text-[10px] text-[#A8A29E] shadow-subtle">
                      ›
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default InteractiveHeroStepper;

