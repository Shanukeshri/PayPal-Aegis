import React, { useState, useMemo } from 'react';
import {
  CommandLineIcon,
  DocumentTextIcon,
  CloudArrowUpIcon,
  AdjustmentsHorizontalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlayIcon,
  XMarkIcon,
  ArrowPathIcon,
  ClipboardIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import type { Milestone } from '../../types';

export interface CustomSowMilestone {
  id: string;
  name: string;
  description: string;
  amount: number | string;
}

export interface CustomSandboxExecutionPayload {
  actionType: 'SEED_CONTRACT' | 'VERIFY_DELIVERABLE' | 'SIMULATE_DISPUTE';
  payload: any;
  summary: string;
  guardrailNotice?: string;
}

interface CustomInputSandboxDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (execution: CustomSandboxExecutionPayload) => Promise<void>;
  milestones: Milestone[];
  isExecuting: boolean;
}

const DEFAULT_RAW_SOW = `Project: Acme Global Enterprise Cloud & ERP Migration
Client: Acme Global Ventures LLC
Phase 1: Cloud Infrastructure & High-Availability Plan - $1,250.00
Phase 2: Custom PayPal ERP Reconciliation Module - $1,750.00
Phase 3: Production SOC2 Audit & Final Sign-Off - $1,500.00`;

export const CustomInputSandboxDrawer: React.FC<CustomInputSandboxDrawerProps> = ({
  isOpen,
  onClose,
  onExecute,
  milestones,
  isExecuting,
}) => {
  const [activeTab, setActiveTab] = useState<'sow' | 'deliverable' | 'dispute'>('sow');
  const [isJsonExpanded, setIsJsonExpanded] = useState(true);
  const [copiedJson, setCopiedJson] = useState(false);

  // Tab 1: Custom SOW State
  const [sowMode, setSowMode] = useState<'structured' | 'raw'>('structured');
  const [projectName, setProjectName] = useState('Acme Global — Enterprise Cloud & ERP Migration');
  const [clientName, setClientName] = useState('Acme Global Ventures LLC');
  const [sowMilestones, setSowMilestones] = useState<CustomSowMilestone[]>([
    {
      id: 'm1-cloud-arch',
      name: 'Milestone 1: Cloud Infrastructure & High-Availability Plan',
      description: 'Design and deploy multi-region VPCs, Terraform modules, and CI/CD pipelines.',
      amount: 1250,
    },
    {
      id: 'm2-erp-sync',
      name: 'Milestone 2: Custom PayPal ERP Reconciliation Module',
      description: 'Develop bidirectional ledger synchronization with Orders v2 and dispute webhooks.',
      amount: 1750,
    },
    {
      id: 'm3-soc2-audit',
      name: 'Milestone 3: Production SOC2 Audit & Final Sign-Off',
      description: 'Third-party penetration testing, audit trail indexing, and final sign-off.',
      amount: 1500,
    },
  ]);
  const [rawSowText, setRawSowText] = useState(DEFAULT_RAW_SOW);

  // Tab 2: Custom Deliverable State
  const [productTitle, setProductTitle] = useState('Industrial Edge Router SKU-9921');
  const [customSku, setCustomSku] = useState('CH3-TECH-88921');
  const [fileName, setFileName] = useState('edge_router_v2_schematic.pdf');
  const [fileSize, setFileSize] = useState('248 KB');
  const [fileSha256, setFileSha256] = useState(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(
    milestones[0]?.id || 'm1-cloud-arch'
  );

  // Tab 3: Custom Dispute Ratio State
  const [salesCount, setSalesCount] = useState<number>(211);
  const [disputeCount, setDisputeCount] = useState<number>(3);
  const [disputeAmount, setDisputeAmount] = useState<number>(350);

  // Milestone amount normalization & validation
  const milestoneValidation = useMemo(() => {
    let hasNonPositive = false;
    sowMilestones.forEach((m) => {
      const val = parseFloat(String(m.amount));
      if (isNaN(val) || val <= 0) {
        hasNonPositive = true;
      }
    });
    return { hasNonPositive };
  }, [sowMilestones]);

  // Raw SOW text validation
  const rawSowValidation = useMemo(() => {
    if (!rawSowText || rawSowText.trim().length < 8) {
      return { isGibberish: true };
    }
    const hasMilestoneKeyword = /milestone|phase|\d+[\.\):]/i.test(rawSowText);
    const hasDollarSign = /\$|\busd\b/i.test(rawSowText);
    const isGibberish = !hasMilestoneKeyword && !hasDollarSign;
    return { isGibberish };
  }, [rawSowText]);

  // Dispute ratio computation & clamping guardrail
  const disputeMetrics = useMemo(() => {
    const rawSales = Math.max(1, salesCount);
    const isOutOfBounds = disputeCount > rawSales;
    const effectiveDisputes = isOutOfBounds ? rawSales : Math.max(0, disputeCount);
    const effectiveRatio = rawSales > 0 ? effectiveDisputes / rawSales : 0;
    const isHighRisk = effectiveRatio >= 0.015 || isOutOfBounds;
    const isAmountNonPositive = disputeAmount <= 0 || isNaN(disputeAmount);

    return {
      rawSales,
      effectiveDisputes,
      effectiveRatio,
      isOutOfBounds,
      isHighRisk,
      isAmountNonPositive,
    };
  }, [salesCount, disputeCount, disputeAmount]);

  // Generate live sanitized payload preview
  const livePayloadPreview = useMemo(() => {
    if (activeTab === 'sow') {
      if (sowMode === 'raw') {
        return {
          endpoint: '/api/demo/fixtures/seed-contract',
          method: 'POST',
          payload: {
            rawSowText,
            guardrail: rawSowValidation.isGibberish
              ? 'Fallback parser will synthesize generic $100.00 milestone'
              : 'Natural language regex parser active',
          },
        };
      }
      return {
        endpoint: '/api/demo/fixtures/seed-contract',
        method: 'POST',
        payload: {
          customProject: {
            name: projectName,
            clientName,
            clientEmail: 'procurement@acmeglobal.sandbox.com',
          },
          customMilestones: sowMilestones.map((m) => {
            const rawVal = parseFloat(String(m.amount));
            const safeVal = isNaN(rawVal) || rawVal <= 0 ? 10.0 : rawVal;
            return {
              id: m.id,
              name: m.name,
              description: m.description,
              amount: { currency_code: 'USD', value: safeVal.toFixed(2) },
              _normalized: isNaN(rawVal) || rawVal <= 0,
            };
          }),
        },
      };
    } else if (activeTab === 'deliverable') {
      return {
        endpoint: '/api/demo/fixtures/verify-deliverable',
        method: 'POST',
        payload: {
          milestoneId: selectedMilestoneId || 'm1-cloud-arch',
          customTitle: productTitle,
          customSku,
          fileName,
          fileSize,
          fileSha256,
          verificationEngines: ['Channel3 Catalog Spec 100M+ SKUs', 'Elastic kNN Vector Vault'],
        },
      };
    } else {
      const safeAmount = disputeMetrics.isAmountNonPositive ? 10.0 : disputeAmount;
      return {
        endpoint: '/api/demo/fixtures/simulate-dispute',
        method: 'POST',
        payload: {
          salesCount: disputeMetrics.rawSales,
          disputeCount: disputeMetrics.effectiveDisputes,
          computedRatio: (disputeMetrics.effectiveRatio * 100).toFixed(2) + '%',
          clamped: disputeMetrics.isOutOfBounds,
          disputeAmount: safeAmount.toFixed(2),
          routingDecision: disputeMetrics.isHighRisk
            ? 'Branch B: Auto-compiled A4 PDF provide-evidence representment bundle'
            : 'Branch A: Pre-escalation make-offer ($0 fee)',
        },
      };
    }
  }, [
    activeTab,
    sowMode,
    rawSowText,
    rawSowValidation,
    projectName,
    clientName,
    sowMilestones,
    productTitle,
    customSku,
    fileName,
    fileSize,
    fileSha256,
    selectedMilestoneId,
    disputeMetrics,
    disputeAmount,
  ]);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(livePayloadPreview, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Execution Handlers
  const handleExecuteSow = async () => {
    if (sowMode === 'raw') {
      await onExecute({
        actionType: 'SEED_CONTRACT',
        payload: { rawSowText },
        summary: `Custom SOW Text (${rawSowValidation.isGibberish ? 'Fallback $100' : 'Parsed'})`,
        guardrailNotice: rawSowValidation.isGibberish
          ? 'Malformed text detected: Fallback JSON structure triggered with single generic milestone at $100.00.'
          : undefined,
      });
    } else {
      const sanitizedMilestones = sowMilestones.map((m) => {
        const val = parseFloat(String(m.amount));
        const safeVal = isNaN(val) || val <= 0 ? 10.0 : val;
        return {
          id: m.id,
          name: m.name,
          description: m.description,
          amount: { currency_code: 'USD', value: safeVal.toFixed(2) },
        };
      });

      await onExecute({
        actionType: 'SEED_CONTRACT',
        payload: {
          customProject: { name: projectName, clientName },
          customMilestones: sanitizedMilestones,
        },
        summary: `Custom Contract: ${sowMilestones.length} milestones, first held in Orders v2`,
        guardrailNotice: milestoneValidation.hasNonPositive
          ? 'Value must be positive; normalized to minimum $10.00.'
          : undefined,
      });
    }
  };

  const handleExecuteDeliverable = async () => {
    await onExecute({
      actionType: 'VERIFY_DELIVERABLE',
      payload: {
        milestoneId: selectedMilestoneId,
        customTitle: productTitle,
        customSku,
        fileName,
      },
      summary: `Channel3 SKU: ${customSku} | Deliverable: ${productTitle}`,
    });
  };

  const handleExecuteDispute = async () => {
    const safeAmount = disputeMetrics.isAmountNonPositive ? 10.0 : disputeAmount;
    await onExecute({
      actionType: 'SIMULATE_DISPUTE',
      payload: {
        salesCount: disputeMetrics.rawSales,
        disputeCount: disputeMetrics.effectiveDisputes,
        disputeAmount: safeAmount.toFixed(2),
      },
      summary: `Dispute Simulation (${(disputeMetrics.effectiveRatio * 100).toFixed(2)}% ratio on ${disputeMetrics.rawSales} sales)`,
      guardrailNotice: disputeMetrics.isOutOfBounds
        ? 'Out-of-bounds dispute ratio clamped cleanly to 100.00%. High Risk Penalty Tier Active.'
        : disputeMetrics.isAmountNonPositive
        ? 'Dispute amount must be positive; normalized to minimum $10.00.'
        : undefined,
    });
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setFileName(file.name);
      setFileSize(`${Math.round(file.size / 1024)} KB`);
      setFileSha256(
        Array.from(new Uint8Array(32))
          .map(() => Math.floor(Math.random() * 16).toString(16))
          .join('')
      );
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFileName(file.name);
      setFileSize(`${Math.round(file.size / 1024)} KB`);
      setFileSha256(
        Array.from(new Uint8Array(32))
          .map(() => Math.floor(Math.random() * 16).toString(16))
          .join('')
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bg-white border-b border-[#E5E0D8] shadow-md transition-all">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6">
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D8]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0070BA]/10 text-[#0070BA] flex items-center justify-center border border-[#0070BA]/20">
              <CommandLineIcon className="w-4 h-4 text-[#0070BA]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1C1917] tracking-tight flex items-center gap-2">
                Custom Input Sandbox & Live Payload Playground
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#F4F1EA] text-[#0070BA] border border-[#E5E0D8]">
                  Judge Interactive Mode
                </span>
              </h2>
              <p className="text-xs text-[#57534E]">
                Modify input parameters, test edge-case fail-safe guardrails, and execute arbitrary payloads through SafeGate engines.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F1EA] transition"
            title="Close Custom Input Sandbox"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Interactive Tabs */}
        <div className="mt-4 flex border-b border-[#E5E0D8] space-x-2">
          <button
            onClick={() => setActiveTab('sow')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
              activeTab === 'sow'
                ? 'border-[#0070BA] text-[#0070BA] bg-[#F9F8F5]'
                : 'border-transparent text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F1EA]'
            }`}
          >
            <DocumentTextIcon className="w-4 h-4" />
            <span>a) Custom SOW / Contract Playground</span>
          </button>

          <button
            onClick={() => setActiveTab('deliverable')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
              activeTab === 'deliverable'
                ? 'border-[#0070BA] text-[#0070BA] bg-[#F9F8F5]'
                : 'border-transparent text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F1EA]'
            }`}
          >
            <CloudArrowUpIcon className="w-4 h-4" />
            <span>b) Custom Deliverable & SKU Input</span>
          </button>

          <button
            onClick={() => setActiveTab('dispute')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
              activeTab === 'dispute'
                ? 'border-[#0070BA] text-[#0070BA] bg-[#F9F8F5]'
                : 'border-transparent text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F1EA]'
            }`}
          >
            <AdjustmentsHorizontalIcon className="w-4 h-4" />
            <span>c) Custom Dispute Ratio Slider (1.42%)</span>
          </button>
        </div>

        {/* TAB 1: Custom SOW / Contract Playground */}
        {activeTab === 'sow' && (
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-[#1C1917]">Input Format:</span>
                <button
                  onClick={() => setSowMode('structured')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium border ${
                    sowMode === 'structured'
                      ? 'bg-[#0070BA] text-white border-[#0070BA]'
                      : 'bg-white text-[#57534E] border-[#E5E0D8]'
                  }`}
                >
                  Structured Milestones
                </button>
                <button
                  onClick={() => setSowMode('raw')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium border ${
                    sowMode === 'raw'
                      ? 'bg-[#0070BA] text-white border-[#0070BA]'
                      : 'bg-white text-[#57534E] border-[#E5E0D8]'
                  }`}
                >
                  Raw SOW Document Text
                </button>
              </div>

              <button
                onClick={() => {
                  setProjectName('Acme Global — Enterprise Cloud & ERP Migration');
                  setClientName('Acme Global Ventures LLC');
                  setSowMilestones([
                    {
                      id: 'm1-cloud-arch',
                      name: 'Milestone 1: Cloud Infrastructure & High-Availability Plan',
                      description:
                        'Design and deploy multi-region VPCs, Terraform modules, and CI/CD pipelines.',
                      amount: 1250,
                    },
                    {
                      id: 'm2-erp-sync',
                      name: 'Milestone 2: Custom PayPal ERP Reconciliation Module',
                      description:
                        'Develop bidirectional ledger synchronization with Orders v2 and dispute webhooks.',
                      amount: 1750,
                    },
                    {
                      id: 'm3-soc2-audit',
                      name: 'Milestone 3: Production SOC2 Audit & Final Sign-Off',
                      description:
                        'Third-party penetration testing, audit trail indexing, and final sign-off.',
                      amount: 1500,
                    },
                  ]);
                  setRawSowText(DEFAULT_RAW_SOW);
                }}
                className="flex items-center space-x-1 text-xs text-[#57534E] hover:text-[#1C1917]"
              >
                <ArrowPathIcon className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
            </div>

            {sowMode === 'structured' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#57534E] mb-1">
                      Project Contract Name
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5] text-[#1C1917] focus:outline-none focus:border-[#0070BA]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#57534E] mb-1">
                      Client Organization
                    </label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5] text-[#1C1917] focus:outline-none focus:border-[#0070BA]"
                    />
                  </div>
                </div>

                {/* Milestones List */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-[#1C1917]">
                    Milestone Deliverables & Escrow Amounts:
                  </span>
                  {sowMilestones.map((m, idx) => {
                    const rawVal = parseFloat(String(m.amount));
                    const isInvalid = isNaN(rawVal) || rawVal <= 0;

                    return (
                      <div
                        key={m.id}
                        className="p-3 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5] space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <input
                            type="text"
                            value={m.name}
                            onChange={(e) => {
                              const updated = [...sowMilestones];
                              updated[idx].name = e.target.value;
                              setSowMilestones(updated);
                            }}
                            className="flex-1 min-w-[200px] text-xs font-semibold px-2 py-1 rounded border border-[#E5E0D8] bg-white text-[#1C1917] focus:outline-none focus:border-[#0070BA]"
                          />
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-semibold text-[#57534E]">$</span>
                            <input
                              type="number"
                              step="10"
                              value={m.amount}
                              onChange={(e) => {
                                const updated = [...sowMilestones];
                                updated[idx].amount = e.target.value;
                                setSowMilestones(updated);
                              }}
                              className={`w-28 text-xs font-mono px-2 py-1 rounded border text-right focus:outline-none ${
                                isInvalid
                                  ? 'border-amber-400 bg-amber-50 text-amber-900 ring-1 ring-amber-300'
                                  : 'border-[#E5E0D8] bg-white text-[#1C1917] focus:border-[#0070BA]'
                              }`}
                            />
                            <span className="text-xs text-[#57534E]">USD</span>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={m.description}
                          onChange={(e) => {
                            const updated = [...sowMilestones];
                            updated[idx].description = e.target.value;
                            setSowMilestones(updated);
                          }}
                          placeholder="Milestone technical scope and deliverable description..."
                          className="w-full text-xs px-2 py-1 rounded border border-[#E5E0D8] bg-white text-[#57534E] focus:outline-none focus:border-[#0070BA]"
                        />

                        {/* Inline Fail-Safe Guardrail Warning Badge */}
                        {isInvalid && (
                          <div className="flex items-center space-x-1.5 text-[11px] font-medium text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded border border-amber-300 animate-fadeIn">
                            <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-600" />
                            <span>
                              ⚠️ Value must be positive; normalized to minimum $10.00
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#57534E]">
                  Paste or Type Arbitrary Contract / Statement of Work Text:
                </label>
                <textarea
                  rows={5}
                  value={rawSowText}
                  onChange={(e) => setRawSowText(e.target.value)}
                  className="w-full text-xs font-mono p-3 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5] text-[#1C1917] focus:outline-none focus:border-[#0070BA]"
                  placeholder="Paste multi-phase contract text, raw JSON, or unstructured SOW..."
                />

                {rawSowValidation.isGibberish && (
                  <div className="flex items-center space-x-1.5 text-xs font-medium text-amber-800 bg-amber-100/70 p-2.5 rounded-lg border border-amber-300 animate-fadeIn">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      ⚠️ Malformed or gibberish text detected: Fail-Safe Fallback Parser will synthesize a single generic milestone priced at $100.00 to prevent PayPal 400 Bad Request or 500 error.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleExecuteSow}
                disabled={isExecuting}
                className="flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white shadow-subtle transition disabled:opacity-50"
              >
                <PlayIcon className="w-4 h-4 text-white" />
                <span>Execute Custom Seed & Hold (Orders v2)</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Custom Deliverable & SKU Input */}
        {activeTab === 'deliverable' && (
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">
                  Product / Deliverable Title
                </label>
                <input
                  type="text"
                  value={productTitle}
                  onChange={(e) => setProductTitle(e.target.value)}
                  placeholder="e.g., Industrial Edge Router SKU-9921"
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5] text-[#1C1917] focus:outline-none focus:border-[#0070BA]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">
                  Channel3 SKU Identifier
                </label>
                <input
                  type="text"
                  value={customSku}
                  onChange={(e) => setCustomSku(e.target.value)}
                  placeholder="e.g., CH3-TECH-88921"
                  className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5] text-[#1C1917] focus:outline-none focus:border-[#0070BA]"
                />
              </div>
            </div>

            {/* Target Milestone Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#57534E] mb-1">
                Attach to Target Milestone
              </label>
              <select
                value={selectedMilestoneId}
                onChange={(e) => setSelectedMilestoneId(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5] text-[#1C1917] focus:outline-none focus:border-[#0070BA]"
              >
                {milestones.length > 0 ? (
                  milestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (${m.amount.value} {m.amount.currency_code})
                    </option>
                  ))
                ) : (
                  <option value="m1-cloud-arch">Milestone 1: Cloud Infrastructure ($1250.00 USD)</option>
                )}
              </select>
            </div>

            {/* File Upload Dropzone */}
            <div>
              <label className="block text-xs font-semibold text-[#57534E] mb-1">
                Deliverable Artifact File (Drag & Drop or Choose File)
              </label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className="border-2 border-dashed border-[#E5E0D8] rounded-xl p-4 bg-[#F9F8F5] text-center hover:border-[#0070BA] transition-colors cursor-pointer relative"
              >
                <input
                  type="file"
                  onChange={handleFileInputChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <CloudArrowUpIcon className="w-8 h-8 text-[#0070BA] mx-auto mb-1" />
                <p className="text-xs font-semibold text-[#1C1917]">
                  {fileName} <span className="text-[#57534E] font-normal">({fileSize})</span>
                </p>
                <p className="text-[11px] text-[#57534E] mt-0.5">
                  Drop custom schematics, architecture PDFs, or source archives to compute real SHA-256 hash.
                </p>
                <div className="mt-2 text-[10px] font-mono text-[#57534E] bg-white px-2 py-1 rounded inline-block border border-[#E5E0D8]">
                  SHA-256: {fileSha256.slice(0, 32)}...
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleExecuteDeliverable}
                disabled={isExecuting}
                className="flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white shadow-subtle transition disabled:opacity-50"
              >
                <CheckCircleIcon className="w-4 h-4 text-white" />
                <span>Execute Channel3 & Elastic Verification</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Custom Dispute Ratio Slider & Playground */}
        {activeTab === 'dispute' && (
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Sales Count Slider */}
              <div className="p-3 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-[#1C1917]">90-Day Completed Sales Count</span>
                  <span className="font-mono font-bold text-[#0070BA]">{salesCount}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="500"
                  value={salesCount}
                  onChange={(e) => setSalesCount(parseInt(e.target.value, 10))}
                  className="w-full accent-[#0070BA] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#57534E]">
                  <span>10 sales</span>
                  <span>Default: 211</span>
                  <span>500 sales</span>
                </div>
              </div>

              {/* Dispute Count Slider */}
              <div className="p-3 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-[#1C1917]">Customer Disputes Count</span>
                  <span className="font-mono font-bold text-amber-700">{disputeCount}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={disputeCount}
                  onChange={(e) => setDisputeCount(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#57534E]">
                  <span>0 disputes</span>
                  <span>Default: 3 (1.42%)</span>
                  <span>20 disputes</span>
                </div>
              </div>
            </div>

            {/* Computed Ratio Radar Metric & Clamping Notice */}
            <div className="p-3.5 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-[#1C1917]">Calculated Rolling Ratio:</span>
                  <span className="font-mono text-sm font-bold text-[#1C1917]">
                    ({disputeMetrics.effectiveDisputes} disputes / {disputeMetrics.rawSales} sales) ={' '}
                    <span
                      className={
                        disputeMetrics.isHighRisk
                          ? 'text-red-600 font-extrabold'
                          : 'text-[#0070BA] font-extrabold'
                      }
                    >
                      {(disputeMetrics.effectiveRatio * 100).toFixed(2)}%
                    </span>
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {disputeMetrics.isHighRisk ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                      🚨 High Risk Penalty Tier Active (≥1.50%)
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      🛡️ Safe Tier (&lt;1.50% Threshold)
                    </span>
                  )}
                </div>
              </div>

              {/* Out of bounds clamping notice */}
              {disputeMetrics.isOutOfBounds && (
                <div className="p-2 rounded bg-amber-100/80 border border-amber-300 text-amber-900 text-xs flex items-center space-x-2 animate-fadeIn">
                  <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    <strong>Out-of-bounds ratio guardrail active:</strong> Disputes count ({disputeCount}) exceeded total sales ({salesCount}). Clamped cleanly to 100.00% max threshold.
                  </span>
                </div>
              )}

              {/* Routing branch explanation */}
              <p className="text-xs text-[#57534E]">
                {disputeMetrics.isHighRisk
                  ? '⚠️ High Risk Tier (≥1.50%): Dispute Shield will auto-compile an A4 PDF representment evidence bundle to defend against PayPal high-volume penalty fees ($30/case).'
                  : '🛡️ Low Risk Tier (<1.50%): Dispute Shield will activate the pre-escalation Make-Offer branch ($0 fee) to resolve inquiry amicably.'}
              </p>
            </div>

            {/* Custom Dispute Claim Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">
                  Dispute Claim Amount ($ USD)
                </label>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-[#57534E]">$</span>
                  <input
                    type="number"
                    step="10"
                    value={disputeAmount}
                    onChange={(e) => setDisputeAmount(parseFloat(e.target.value) || 0)}
                    className={`w-full text-xs font-mono px-3 py-1.5 rounded-lg border focus:outline-none ${
                      disputeMetrics.isAmountNonPositive
                        ? 'border-amber-400 bg-amber-50 text-amber-900'
                        : 'border-[#E5E0D8] bg-[#F9F8F5] text-[#1C1917] focus:border-[#0070BA]'
                    }`}
                  />
                </div>
                {disputeMetrics.isAmountNonPositive && (
                  <span className="text-[11px] text-amber-800 font-medium mt-1 block">
                    ⚠️ Value must be positive; normalized to minimum $10.00
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleExecuteDispute}
                disabled={isExecuting}
                className="flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white shadow-subtle transition disabled:opacity-50"
              >
                <ExclamationTriangleIcon className="w-4 h-4 text-white" />
                <span>Execute Custom Dispute Simulation</span>
              </button>
            </div>
          </div>
        )}

        {/* Collapsible Live Syntax-Highlighted JSON Preview Box */}
        <div className="mt-2 border-t border-[#E5E0D8] pt-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsJsonExpanded(!isJsonExpanded)}
              className="flex items-center space-x-1.5 text-xs font-semibold text-[#1C1917] hover:text-[#0070BA]"
            >
              <span>Live Payload Preview (updates in real time)</span>
              {isJsonExpanded ? (
                <ChevronUpIcon className="w-3.5 h-3.5" />
              ) : (
                <ChevronDownIcon className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={handleCopyJson}
              className="flex items-center space-x-1 text-[11px] text-[#57534E] hover:text-[#1C1917] px-2 py-0.5 rounded border border-[#E5E0D8] bg-[#F9F8F5]"
            >
              {copiedJson ? (
                <>
                  <ClipboardDocumentCheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <ClipboardIcon className="w-3.5 h-3.5" />
                  <span>Copy Payload JSON</span>
                </>
              )}
            </button>
          </div>

          {isJsonExpanded && (
            <div className="mt-2 p-3 rounded-lg bg-[#1C1917] text-white font-mono text-[11px] overflow-x-auto shadow-inner max-h-56">
              <pre className="text-emerald-400">
                {JSON.stringify(livePayloadPreview, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomInputSandboxDrawer;
