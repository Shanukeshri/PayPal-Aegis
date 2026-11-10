import React from 'react';
import {
  ShieldCheckIcon,
  CpuChipIcon,
  ServerIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

export interface PipelineStepState {
  step: number; // 0 = idle, 1 = Ingestion, 2 = APIMatic, 3 = SafeGate, 4 = PayPal Sandbox, 5 = Complete
  isExecuting: boolean;
  actionName?: string;
  guardrailNotice?: string;
  latencyMs?: number;
  payloadSummary?: any;
}

interface LivePipelineVisualizerProps {
  pipelineState: PipelineStepState;
  onDismissNotice?: () => void;
}

export const LivePipelineVisualizer: React.FC<LivePipelineVisualizerProps> = ({
  pipelineState,
  onDismissNotice,
}) => {
  const { step, isExecuting, actionName, guardrailNotice, latencyMs, payloadSummary } = pipelineState;

  const nodes = [
    {
      id: 1,
      title: '1. Ingestion & Guardrails',
      subtitle: 'Fail-Safe Normalizer',
      desc: 'Positive amounts (min $10.00), SOW fallback parser, dispute clamp ≤100%',
      icon: CpuChipIcon,
      badge: 'Fail-Safe Active',
    },
    {
      id: 2,
      title: '2. APIMatic Grounding',
      subtitle: 'SDK Router & Context',
      desc: 'PayPal Orders v2 / Disputes SDK contract grounding & HATEOAS route resolve',
      icon: SparklesIcon,
      badge: 'Context Grounded',
    },
    {
      id: 3,
      title: '3. SafeGate Firewall',
      subtitle: 'MCP Security Proxy',
      desc: 'Channel3 SKU catalog check, Elastic kNN vector match & HITL interceptor',
      icon: ShieldCheckIcon,
      badge: 'Firewall Enforced',
    },
    {
      id: 4,
      title: '4. PayPal Sandbox Engine',
      subtitle: 'api-m.sandbox.paypal.com',
      desc: 'Escrow hold locks, authorization rotation, CRC32 webhooks & ledger sync',
      icon: ServerIcon,
      badge: 'Live Sandbox Target',
    },
  ];

  const getNodeStatus = (nodeId: number) => {
    if (!isExecuting && step === 0) return 'IDLE';
    if (step === 5) return 'COMPLETED';
    if (step === nodeId) return 'ACTIVE';
    if (step > nodeId) return 'PASSED';
    return 'WAITING';
  };

  return (
    <section className="bg-white border border-[#E5E0D8] rounded-xl shadow-subtle p-5 transition-all">
      {/* Pipeline Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E5E0D8]">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-[#0070BA] flex items-center justify-center text-white shadow-subtle">
            <CpuChipIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-[#1C1917] flex items-center gap-2">
              Live Execution Pipeline Canvas
              <span className="font-mono text-[10px] text-[#57534E] font-normal">
                (APIMatic Router → SafeGate Firewall → PayPal Sandbox)
              </span>
            </h2>
            <p className="text-xs text-[#57534E]">
              Visualizes real-time payload travel, fail-safe guardrail normalization, and sandbox proxy routing.
            </p>
          </div>
        </div>

        {/* Execution Telemetry Status Badge */}
        <div className="flex items-center space-x-2">
          {isExecuting ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#0070BA]/10 text-[#0070BA] border border-[#0070BA]/30 animate-pulse">
              <span className="w-2 h-2 rounded-full mr-2 bg-[#0070BA] animate-ping" />
              IN-FLIGHT: Step {step} of 4 — {actionName || 'Processing'}
            </span>
          ) : step === 5 ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#F4F1EA] text-[#0070BA] border border-[#0070BA]/30">
              <CheckCircleIcon className="w-4 h-4 mr-1 text-[#0070BA]" />
              SUCCESS: 200 OK • {latencyMs ? `${latencyMs}ms` : '142ms'}
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#F4F1EA] text-[#57534E] border border-[#E5E0D8]">
              <span className="w-2 h-2 rounded-full mr-2 bg-[#57534E]" />
              PIPELINE READY • STANDBY
            </span>
          )}

          {latencyMs && (
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono bg-[#F9F8F5] text-[#57534E] border border-[#E5E0D8]">
              <ClockIcon className="w-3.5 h-3.5 mr-1" />
              {latencyMs}ms
            </span>
          )}
        </div>
      </div>

      {/* Guardrail Callout Banner */}
      {guardrailNotice && (
        <div className="mt-3.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="font-medium">
              <strong className="font-semibold">Guardrail Active:</strong> {guardrailNotice}
            </span>
          </div>
          {onDismissNotice && (
            <button
              onClick={onDismissNotice}
              className="text-amber-700 hover:text-amber-900 font-bold ml-2 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* 4-Node Live Pipeline Canvas */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 relative">
        {nodes.map((node, index) => {
          const status = getNodeStatus(node.id);
          const isNodeActive = status === 'ACTIVE';
          const isNodePassed = status === 'PASSED' || status === 'COMPLETED';

          return (
            <div
              key={node.id}
              className={`relative rounded-xl p-3.5 border transition-all duration-300 ${
                isNodeActive
                  ? 'bg-blue-50/50 border-[#0070BA] shadow-md ring-2 ring-[#0070BA]/20'
                  : isNodePassed
                  ? 'bg-[#F9F8F5] border-[#0070BA]/40'
                  : 'bg-white border-[#E5E0D8] opacity-75'
              }`}
            >
              {/* Node Top Line */}
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    isNodeActive
                      ? 'bg-[#0070BA] text-white shadow-sm'
                      : isNodePassed
                      ? 'bg-[#0070BA]/20 text-[#0070BA]'
                      : 'bg-[#F4F1EA] text-[#57534E]'
                  }`}
                >
                  <node.icon className="w-4 h-4" />
                </div>

                {/* Node Status Indicator */}
                <div>
                  {isNodeActive ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#0070BA] text-white uppercase tracking-wider animate-pulse">
                      Processing
                    </span>
                  ) : isNodePassed ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                      ✓ Passed
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#F4F1EA] text-[#57534E] uppercase tracking-wider">
                      Idle
                    </span>
                  )}
                </div>
              </div>

              {/* Node Content */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-[#1C1917] tracking-tight">{node.title}</h3>
                <p className="text-[11px] font-semibold text-[#0070BA]">{node.subtitle}</p>
                <p className="text-[11px] text-[#57534E] leading-relaxed line-clamp-2">{node.desc}</p>
              </div>

              {/* Step indicator arrow for desktop view */}
              {index < 3 && (
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border border-[#E5E0D8] items-center justify-center shadow-subtle">
                  <ArrowRightIcon
                    className={`w-3 h-3 ${
                      step > node.id ? 'text-[#0070BA]' : 'text-[#A8A29E]'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Track Line */}
      <div className="mt-4 pt-3 border-t border-[#E5E0D8]/60 flex items-center justify-between text-[11px] text-[#57534E]">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0070BA]" />
          <span>
            {isExecuting
              ? `Real-time Execution: Routing parameters through SafeGate Firewall...`
              : step === 5
              ? `Action execution completed successfully. Ledger updated & Gantt state synchronized.`
              : `Ready to accept default fixtures or arbitrary custom sandbox inputs.`}
          </span>
        </div>

        {payloadSummary && (
          <div className="text-[10px] font-mono text-[#57534E] bg-[#F4F1EA] px-2 py-0.5 rounded border border-[#E5E0D8]">
            {payloadSummary}
          </div>
        )}
      </div>
    </section>
  );
};

export default LivePipelineVisualizer;
