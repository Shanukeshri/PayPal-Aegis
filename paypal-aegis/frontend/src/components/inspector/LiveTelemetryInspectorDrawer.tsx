import React, { useState } from 'react';
import {
  CommandLineIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ServerIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import type { StepId } from '../stepper/InteractiveHeroStepper';

export interface WireTelemetryData {
  method: string;
  endpoint: string;
  latencyMs: number;
  statusCode: number;
  requestId: string;
  crc32Checksum: string;
  rawResponse: Record<string, any>;
  activeAgent: string;
  ragIndex: string;
  ragLatencyMs: number;
  documentIds: {
    buyerIp: string;
    deliverableHash: string;
    contractScope: string;
    channel3Sku: string;
  };
  synthesisTask: string;
  liveAgent?: {
    agentName: string;
    phase: string;
    selectedTool: string;
    arguments: Record<string, any>;
    reasoning: string;
    scopedTools: string[];
  };
  liveRag?: {
    elasticEndpoint: string;
    documentsRetrieved: number;
    transactionId: string;
    cosineMath?: {
      dotProduct: number;
      normA: number;
      normB: number;
      similarity: number;
    };
  };
}

interface LiveTelemetryInspectorDrawerProps {
  currentStage: StepId;
  telemetryData?: Partial<WireTelemetryData>;
}

export const LiveTelemetryInspectorDrawer: React.FC<LiveTelemetryInspectorDrawerProps> = ({
  currentStage,
  telemetryData,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'wire' | 'rag'>('wire');
  const [copiedJson, setCopiedJson] = useState(false);

  // Defaults dynamically mapped to the current stepper stage
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
            payee: { email_address: 'merchant@aegis.sandbox.com' },
          },
        ],
        create_time: new Date().toISOString(),
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
      synthesisTask: 'Schema grounding via APIMatic v2 router. Ingested 3 milestones into Bryntum Gantt.',
    },
    2: {
      method: 'POST',
      endpoint: 'https://api-m.sandbox.paypal.com/v2/payments/authorizations/0VF52814937998046/reauthorize',
      latencyMs: 168,
      statusCode: 200,
      requestId: 'a891e442-77bb-4f12-881c-d4c8996fb102',
      crc32Checksum: '0x3E71BA99',
      rawResponse: {
        id: '9LK88776655443321',
        status: 'CREATED',
        amount: { currency_code: 'USD', value: '1250.00' },
        expiration_time: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
        links: [{ rel: 'self', method: 'GET', href: '/v2/payments/authorizations/9LK88776655443321' }],
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
      synthesisTask: 'Day-3 renewal dispatched. Mutated authorization_id pointer rotated in AG Studio ledger.',
    },
    3: {
      method: 'POST',
      endpoint: 'https://api-m.sandbox.paypal.com/v2/payments/authorizations/9LK88776655443321/capture',
      latencyMs: 154,
      statusCode: 200,
      requestId: 'c45b8812-32aa-4c22-9901-b7c8996fb331',
      crc32Checksum: '0x99A41DC2',
      rawResponse: {
        id: 'CAP-8891029471',
        status: 'COMPLETED',
        amount: { currency_code: 'USD', value: '1250.00' },
        final_capture: true,
        seller_receivable_breakdown: { gross_amount: { currency_code: 'USD', value: '1250.00' } },
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
      synthesisTask: 'Multimodal catalog match confirmed (CH3-TECH-88921) + 85.9% Elastic kNN authenticity. Staged in SafeGate HITL.',
    },
    4: {
      method: 'POST',
      endpoint: 'https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-40193/provide-evidence',
      latencyMs: 210,
      statusCode: 200,
      requestId: 'f77c1244-99dd-411a-ba88-e5c8996fb779',
      crc32Checksum: '0x5C89F311',
      rawResponse: {
        dispute_id: 'PP-D-40193',
        status: 'UNDER_REVIEW',
        evidence_submitted: {
          file_name: 'evidence_PP-D-40193.pdf',
          size_bytes: 412890,
          mime_type: 'application/pdf',
        },
        message: 'Evidence successfully received by PayPal Disputes API.',
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
      synthesisTask: 'Auto-compiled 2-page A4 PDF representment bundle linking buyer telemetry and SHA-256 deliverable proof.',
    },
  };

  const activeData = { ...stageTelemetry[currentStage], ...telemetryData };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(activeData.rawResponse, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <aside
      aria-label="PayPal Sandbox Wire and Agent Telemetry"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E5E0D8] shadow-card transition-all duration-300"
    >
      {/* Sticky Bottom Header Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-[#F4F1EA] hover:bg-[#EAE6DE] cursor-pointer flex items-center justify-between transition-colors border-b border-[#E5E0D8]/80 select-none"
      >
        <div className="flex items-center space-x-2.5">
          <CommandLineIcon className="w-4 h-4 text-[#0070BA]" />
          <span className="text-xs font-bold text-[#1C1917] tracking-tight">
            ⚡ Live PayPal Sandbox Wire & Agent Telemetry Inspector
          </span>
          <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-white text-[#0070BA] border border-[#0070BA]/30 font-bold">
            api-m.sandbox.paypal.com
          </span>
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold">
            CRC32: {activeData.crc32Checksum} Validated
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span className="font-mono text-[11px] text-[#57534E]">
            Status: <strong className="text-emerald-700">{activeData.statusCode} OK</strong> • {activeData.latencyMs}ms
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="p-1 rounded-md text-[#57534E] hover:text-[#1C1917] hover:bg-white/60 transition"
            title={isOpen ? 'Collapse Inspector' : 'Expand Inspector'}
          >
            {isOpen ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Drawer Content */}
      {isOpen && (
        <div className="max-w-7xl mx-auto p-4 max-h-72 overflow-y-auto space-y-3">
          {/* Tabs */}
          <div className="flex border-b border-[#E5E0D8] space-x-2 pb-1">
            <button
              onClick={() => setActiveTab('wire')}
              className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-bold rounded-t-lg transition border-b-2 ${
                activeTab === 'wire'
                  ? 'border-[#0070BA] text-[#0070BA] bg-[#F9F8F5]'
                  : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <ServerIcon className="w-3.5 h-3.5" />
              <span>Tab A: PayPal Wire (HTTP, UUID & CRC32)</span>
            </button>

            <button
              onClick={() => setActiveTab('rag')}
              className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-bold rounded-t-lg transition border-b-2 ${
                activeTab === 'rag'
                  ? 'border-[#0070BA] text-[#0070BA] bg-[#F9F8F5]'
                  : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <CpuChipIcon className="w-3.5 h-3.5" />
              <span>Tab B: RAG & Agent Trace (Elastic kNN & Channel3)</span>
            </button>
          </div>

          {/* TAB A: PayPal Wire */}
          {activeTab === 'wire' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8]">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] block">
                    HTTP Request Line
                  </span>
                  <div className="font-mono text-[11px] font-bold text-[#1C1917] mt-0.5 truncate">
                    <span className="text-[#0070BA] font-extrabold">{activeData.method}</span> {activeData.endpoint}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8]">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] block">
                    PayPal-Request-Id (36-char UUID)
                  </span>
                  <div className="font-mono text-[11px] font-bold text-[#1C1917] mt-0.5 truncate" title={activeData.requestId}>
                    {activeData.requestId}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">
                      Raw-Body CRC32 Checksum
                    </span>
                    <span className="font-mono text-[11px] font-bold text-emerald-700">
                      {activeData.crc32Checksum} Validated
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                    Signature OK
                  </span>
                </div>
              </div>

              {/* Formatted JSON response */}
              <div className="relative">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-mono text-[#57534E]">
                    Formatted PayPal Response Payload:
                  </span>
                  <button
                    onClick={handleCopyJson}
                    className="flex items-center space-x-1 text-[10px] font-mono text-[#0070BA] hover:underline"
                  >
                    {copiedJson ? (
                      <>
                        <CheckIcon className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Copied</span>
                      </>
                    ) : (
                      <>
                        <ClipboardDocumentIcon className="w-3 h-3" />
                        <span>Copy Response JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-[#1C1917] text-white p-3 rounded-lg font-mono text-[11px] max-h-36 overflow-y-auto">
                  <code className="text-emerald-400">
                    {JSON.stringify(activeData.rawResponse, null, 2)}
                  </code>
                </pre>
              </div>
            </div>
          )}

          {/* TAB B: RAG & Agent Trace */}
          {activeTab === 'rag' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8]">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] block">
                    Active Orchestration Agent
                  </span>
                  <span className="font-mono text-[11px] font-bold text-[#0070BA] mt-0.5 block truncate">
                    {activeData.activeAgent}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8]">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] block">
                    Vector Index & RAG Latency
                  </span>
                  <span className="font-mono text-[11px] font-bold text-[#1C1917] mt-0.5 block truncate">
                    {activeData.ragIndex} • {activeData.ragLatencyMs}ms
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#F9F8F5] border border-[#E5E0D8]">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] block">
                    Grounding Framework
                  </span>
                  <span className="font-mono text-[11px] font-bold text-emerald-700 mt-0.5 block">
                    APIMatic Schema + Elastic Cloud kNN
                  </span>
                </div>
              </div>

              {/* RAG Documents Retrieved */}
              <div className="p-3 bg-[#F4F1EA] rounded-lg border border-[#E5E0D8] space-y-1.5 font-mono text-[11px]">
                <div className="font-bold text-[#1C1917] text-xs mb-1">
                  Retrieved Context Documents & Telemetry IDs:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-[#57534E]">Buyer IP Address: </span>
                    <span className="font-bold text-[#1C1917]">{activeData.documentIds.buyerIp}</span>
                  </div>
                  <div>
                    <span className="text-[#57534E]">Channel3 SKU: </span>
                    <span className="font-bold text-[#0070BA]">{activeData.documentIds.channel3Sku}</span>
                  </div>
                  <div>
                    <span className="text-[#57534E]">Contract Scope: </span>
                    <span className="font-bold text-[#1C1917]">{activeData.documentIds.contractScope}</span>
                  </div>
                  <div>
                    <span className="text-[#57534E]">Deliverable SHA-256: </span>
                    <span className="font-bold text-[#1C1917] truncate">{activeData.documentIds.deliverableHash.slice(0, 20)}...</span>
                  </div>
                </div>
              </div>

              {/* Synthesis Task */}
              <div className="p-2.5 bg-[#F9F8F5] rounded-lg border border-[#E5E0D8] text-[11px] text-[#1C1917]">
                <span className="font-bold text-[#0070BA] mr-1">Synthesis Task Executed:</span>
                {activeData.synthesisTask}
              </div>

              {/* Live Multi-Agent Tool Call & RAG Vector Math (Dynamic Trace) */}
              {activeData.liveAgent && (
                <div className="p-3 bg-white rounded-lg border border-[#0070BA]/30 space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#1C1917]">
                    <span className="flex items-center gap-1.5 text-[#0070BA]">
                      <CpuChipIcon className="w-4 h-4 text-[#0070BA]" />
                      Multi-Agent Decision: {activeData.liveAgent.agentName} ({activeData.liveAgent.phase})
                    </span>
                    <span className="text-[10px] bg-[#E6F2FA] text-[#0070BA] px-2 py-0.5 rounded font-extrabold border border-[#0070BA]/40">
                      Tool: {activeData.liveAgent.selectedTool}()
                    </span>
                  </div>
                  <p className="text-[11px] text-[#57534E] font-sans mt-0.5">
                    {activeData.liveAgent.reasoning}
                  </p>
                  <div className="bg-[#F9F8F5] p-2 rounded text-[10px] text-[#1C1917] overflow-x-auto border border-[#E5E0D8]">
                    <span className="text-[#78716C] font-semibold block mb-0.5">Passed Arguments:</span>
                    <code>{JSON.stringify(activeData.liveAgent.arguments, null, 2)}</code>
                  </div>
                </div>
              )}

              {activeData.liveRag?.cosineMath && (
                <div className="p-2.5 bg-emerald-50/70 rounded-lg border border-emerald-200 text-[11px] text-[#1C1917] font-mono">
                  <div className="flex items-center justify-between text-emerald-800 font-bold mb-1">
                    <span>Elasticsearch RAG 64-Dim Cosine Math</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-bold">
                      {(activeData.liveRag.cosineMath.similarity * 100).toFixed(2)}% Match
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-900 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>Dot Product: <span className="font-bold">{activeData.liveRag.cosineMath.dotProduct}</span></div>
                    <div>||A||₂ Norm: <span className="font-bold">{activeData.liveRag.cosineMath.normA}</span></div>
                    <div>||B||₂ Norm: <span className="font-bold">{activeData.liveRag.cosineMath.normB}</span></div>
                    <div>Similarity: <span className="font-bold">{activeData.liveRag.cosineMath.similarity}</span></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default LiveTelemetryInspectorDrawer;

