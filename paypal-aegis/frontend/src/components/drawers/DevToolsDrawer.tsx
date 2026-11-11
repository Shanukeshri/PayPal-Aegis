import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  WrenchScrewdriverIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  CpuChipIcon,
  ServerIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import StateMutationDiffBanner from '../diff/StateMutationDiffBanner';
import { copyTextToClipboard } from '../../lib/workflow';
import type {
  AgentKey,
  StepId,
  WireTelemetryData,
  StateMutationDiff,
} from '../../types';

interface DevToolsDrawerProps {
  isOpen: boolean;
  initialTab?: 'wire' | 'trace' | 'diff';
  onClose: () => void;
  currentStage: StepId;
  telemetryData?: Partial<WireTelemetryData>;
  diffs: StateMutationDiff[];
  activeAgent: AgentKey;
  isExecuting: boolean;
  liveAgentInfo?: { agentName: string; phase: string; status: string } | null;
}

export const DevToolsDrawer: React.FC<DevToolsDrawerProps> = ({
  isOpen,
  initialTab = 'wire',
  onClose,
  currentStage,
  telemetryData,
  diffs,
  activeAgent,
  isExecuting,
  liveAgentInfo,
}) => {
  const [activeTab, setActiveTab] = useState<'wire' | 'trace' | 'diff'>(initialTab);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const stageTelemetry: Record<StepId, WireTelemetryData> = {
    1: {
      method: 'POST',
      endpoint: 'https://api-m.sandbox.paypal.com/v2/checkout/orders',
      latencyMs: 142,
      statusCode: 201,
      requestId: 'd3b0c442-98fc-1c14-9afb-f4c8996fb924',
      crc32Checksum: '0x8F3C921A',
      rawResponse: {
        id: '8CP91024MV91820',
        status: 'CREATED',
        intent: 'AUTHORIZE',
        purchase_units: [
          {
            reference_id: 'm1-cloud-arch',
            amount: { currency_code: 'USD', value: '1250.00' },
          },
        ],
      },
      activeAgent: 'ContractParser (APIMatic Grounded)',
      ragIndex: 'elastic-aegis-sow-contracts',
      ragLatencyMs: 14.2,
      documentIds: {
        buyerIp: '203.0.113.42',
        deliverableHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        contractScope: 'DOC-SOW-2026-AG-091',
        channel3Sku: 'CH3-TECH-88921',
      },
      synthesisTask:
        'Schema grounding via APIMatic v2 router. Parsed contract into 3 milestones.',
    },
    2: {
      method: 'POST',
      endpoint:
        'https://api-m.sandbox.paypal.com/v2/payments/authorizations/0VF52814937998046/reauthorize',
      latencyMs: 168,
      statusCode: 200,
      requestId: 'a891e442-77bb-4f12-881c-d4c8996fb102',
      crc32Checksum: '0x3E71BA99',
      rawResponse: {
        id: '9LK88776655443321',
        status: 'CREATED',
        amount: { currency_code: 'USD', value: '1250.00' },
      },
      activeAgent: '72h Hold Keeper (Render Workflows)',
      ragIndex: 'elastic-aegis-ledger-pointers',
      ragLatencyMs: 12.8,
      documentIds: {
        buyerIp: '203.0.113.42',
        deliverableHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        contractScope: 'DOC-SOW-2026-AG-091',
        channel3Sku: 'CH3-TECH-88921',
      },
      synthesisTask:
        'Day-3 renewal dispatched. Mutated authorization_id pointer rotated in ledger.',
    },
    3: {
      method: 'POST',
      endpoint:
        'https://api-m.sandbox.paypal.com/v2/payments/authorizations/9LK88776655443321/capture',
      latencyMs: 154,
      statusCode: 200,
      requestId: 'c45b8812-32aa-4c22-9901-b7c8996fb331',
      crc32Checksum: '0x99A41DC2',
      rawResponse: {
        id: 'CAP-8891029471',
        status: 'COMPLETED',
        amount: { currency_code: 'USD', value: '1250.00' },
      },
      activeAgent: 'DeliveryAuditor (Vision + Channel3 Catalog RAG)',
      ragIndex: 'channel3-catalog-embeddings + elastic-kNN',
      ragLatencyMs: 18.4,
      documentIds: {
        buyerIp: '203.0.113.42',
        deliverableHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        contractScope: 'DOC-SOW-2026-AG-091',
        channel3Sku: 'CH3-TECH-88921',
      },
      synthesisTask:
        'Multimodal catalog match confirmed (CH3-TECH-88921) via 64-dim vector cosine similarity.',
    },
    4: {
      method: 'POST',
      endpoint:
        'https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-40193/provide-evidence',
      latencyMs: 210,
      statusCode: 200,
      requestId: 'f77c1244-99dd-411a-ba88-e5c8996fb779',
      crc32Checksum: '0x5C89F311',
      rawResponse: {
        dispute_id: 'PP-D-40193',
        status: 'UNDER_REVIEW',
        evidence_submitted: { file_name: 'evidence_PP-D-40193.pdf', mime_type: 'application/pdf' },
      },
      activeAgent: 'DisputeStrategist (Elastic Audit RAG + Legal PDF Compiler)',
      ragIndex: 'elastic-transactional-delivery-logs',
      ragLatencyMs: 22.1,
      documentIds: {
        buyerIp: '203.0.113.42',
        deliverableHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        contractScope: 'DOC-SOW-2026-AG-091',
        channel3Sku: 'CH3-TECH-88921',
      },
      synthesisTask:
        'Auto-compiled 2-page A4 PDF representment bundle linking buyer telemetry and deliverable proof.',
    },
  };

  const activeData = { ...stageTelemetry[currentStage], ...telemetryData };

  const handleDownloadAuditLogs = () => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:3001/api');
    window.open(`${apiUrl}/demo/audit-logs?download=true`, '_blank');
  };

  const handleCopyJson = () => {
    void copyTextToClipboard(JSON.stringify(activeData.rawResponse, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const agents: Array<{ key: Exclude<AgentKey, null>; tech: string }> = [
    { key: 'ContractParser', tech: 'APIMatic v2' },
    { key: 'DeliveryAuditor', tech: 'Channel3 + Elastic' },
    { key: 'DisputeStrategist', tech: 'Audit RAG + A4' },
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1C1917]/40 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <aside
        aria-label="Developer Tools Drawer"
        className="bg-white w-full max-w-2xl h-full shadow-2xl border-l border-[#E5E0D8] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E0D8] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F4F1EA] text-[#1C1917] flex items-center justify-center border border-[#E5E0D8]">
              <WrenchScrewdriverIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1C1917]">Developer Tools</h2>
              <p className="text-[11px] text-[#57534E]">
                Wire telemetry, AI agent reasoning, state diffs, and audit logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadAuditLogs}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8]"
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5 text-[#0070BA]" />
              <span>Audit Logs (.json)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Developer Tools"
              className="p-1.5 rounded-lg text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F1EA]"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Small Agent Status List */}
        <div className="px-5 py-2.5 bg-[#F9F8F5] border-b border-[#E5E0D8] flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] mr-1">
            Agents:
          </span>
          {agents.map((ag) => {
            const active =
              (activeAgent === ag.key && isExecuting) ||
              (liveAgentInfo?.status === 'THINKING' && liveAgentInfo.agentName.includes(ag.key));
            return (
              <span
                key={ag.key}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] border ${
                  active
                    ? 'bg-[#E6F2FA] border-[#0070BA]/40 text-[#0070BA] font-semibold'
                    : 'bg-white border-[#E5E0D8] text-[#1C1917]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    active ? 'bg-[#0070BA] animate-ping' : 'bg-emerald-500'
                  }`}
                />
                <span>{ag.key}</span>
                <span className="text-[10px] font-mono text-[#78716C]">({ag.tech})</span>
              </span>
            );
          })}
        </div>

        {/* Sub-Tabs */}
        <div className="px-5 pt-3 border-b border-[#E5E0D8] flex space-x-2">
          {[
            { id: 'wire' as const, label: 'Wire Inspector', icon: ServerIcon },
            { id: 'trace' as const, label: 'Agent Trace', icon: CpuChipIcon },
            { id: 'diff' as const, label: `State Diff (${diffs.length})`, icon: BoltIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-[#0070BA] text-[#0070BA]'
                  : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'wire' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8]">
                  <span className="text-[10px] font-bold uppercase text-[#78716C] block">
                    HTTP Request
                  </span>
                  <div className="font-mono text-[11px] font-bold text-[#1C1917] mt-1 break-all">
                    <span className="text-[#0070BA]">{activeData.method}</span>{' '}
                    {activeData.endpoint}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8]">
                  <span className="text-[10px] font-bold uppercase text-[#78716C] block">
                    Status &amp; Latency
                  </span>
                  <div className="font-mono text-[11px] font-bold text-emerald-700 mt-1">
                    {activeData.statusCode} OK · {activeData.latencyMs}ms
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8]">
                  <span className="text-[10px] font-bold uppercase text-[#78716C] block">
                    PayPal-Request-Id
                  </span>
                  <div className="font-mono text-[11px] text-[#1C1917] mt-1 truncate">
                    {activeData.requestId}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8]">
                  <span className="text-[10px] font-bold uppercase text-[#78716C] block">
                    CRC32 Checksum
                  </span>
                  <div className="font-mono text-[11px] font-bold text-emerald-700 mt-1">
                    {activeData.crc32Checksum} Validated
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-[#57534E]">
                    JSON Response Payload
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-[#0070BA] hover:underline"
                  >
                    {copiedJson ? (
                      <>
                        <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-[#1C1917] text-emerald-400 p-3.5 rounded-lg font-mono text-[11px] overflow-x-auto max-h-96">
                  {JSON.stringify(activeData.rawResponse, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'trace' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8]">
                  <span className="text-[10px] font-bold uppercase text-[#78716C] block">
                    Active Agent
                  </span>
                  <span className="font-mono text-[11px] font-bold text-[#0070BA] mt-1 block">
                    {activeData.activeAgent}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8]">
                  <span className="text-[10px] font-bold uppercase text-[#78716C] block">
                    Vector Index &amp; Latency
                  </span>
                  <span className="font-mono text-[11px] font-bold text-[#1C1917] mt-1 block">
                    {activeData.ragIndex} · {activeData.ragLatencyMs}ms
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#F4F1EA] border border-[#E5E0D8] font-mono text-[11px] space-y-1">
                <div className="font-bold text-[#1C1917]">Retrieved Context Telemetry</div>
                <div>Buyer IP: {activeData.documentIds.buyerIp}</div>
                <div>Channel3 SKU: {activeData.documentIds.channel3Sku}</div>
                <div>Contract Scope: {activeData.documentIds.contractScope}</div>
                <div className="truncate">
                  SHA-256: {activeData.documentIds.deliverableHash}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8] text-xs">
                <span className="font-semibold text-[#0070BA]">Synthesis Task: </span>
                <span className="text-[#1C1917]">{activeData.synthesisTask}</span>
              </div>

              {activeData.liveAgent && (
                <div className="p-3.5 rounded-lg bg-white border border-[#0070BA]/30 space-y-2 font-mono text-[11px]">
                  <div className="flex items-center justify-between font-bold text-[#1C1917]">
                    <span>
                      {activeData.liveAgent.agentName} ({activeData.liveAgent.phase})
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#E6F2FA] text-[#0070BA]">
                      {activeData.liveAgent.selectedTool}()
                    </span>
                  </div>
                  <p className="font-sans text-xs text-[#57534E]">
                    {activeData.liveAgent.reasoning}
                  </p>
                  {activeData.liveAgent.scopedTools?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-[#78716C] uppercase font-semibold">
                        Scoped Tools:
                      </span>
                      {activeData.liveAgent.scopedTools.map((tool) => (
                        <span
                          key={tool}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8]"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
                  <pre className="bg-[#F9F8F5] p-2.5 rounded border border-[#E5E0D8] text-[10px] overflow-x-auto">
                    {JSON.stringify(activeData.liveAgent.arguments, null, 2)}
                  </pre>
                </div>
              )}

              {activeData.liveRag?.cosineMath && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 font-mono text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-emerald-900">
                    <span>Elasticsearch 64-Dim Cosine Math</span>
                    <span>{(activeData.liveRag.cosineMath.similarity * 100).toFixed(1)}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-emerald-900">
                    <div>
                      Dot Product: {activeData.liveRag.cosineMath.dotProduct.toFixed(4)}
                    </div>
                    <div>||A||₂: {activeData.liveRag.cosineMath.normA}</div>
                    <div>||B||₂: {activeData.liveRag.cosineMath.normB}</div>
                    <div>
                      Similarity: {activeData.liveRag.cosineMath.similarity.toFixed(3)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'diff' && (
            <div>
              {diffs.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#78716C] border border-dashed border-[#E5E0D8] rounded-xl">
                  No state mutations recorded yet.
                </div>
              ) : (
                <StateMutationDiffBanner diffs={diffs} showHistoryList />
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export default DevToolsDrawer;
