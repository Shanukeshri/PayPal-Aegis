import React, { useState, useMemo, useEffect } from 'react';
import {
  XMarkIcon,
  PlayIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardIcon,
  ClipboardDocumentCheckIcon,
  CloudArrowUpIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import type {
  Milestone,
  StepId,
  StepExecutionInfo,
  CustomSowMilestone,
  CustomSandboxExecutionPayload,
} from '../../types';
import { computeFileSha256Hex } from '../../lib/workflow';

interface DemoControlsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  milestones: Milestone[];
  executingStep: StepId | null;
  stepStatusMap: Record<StepId, StepExecutionInfo>;
  busyAction: string | null;
  onExecuteStep: (stepId: StepId, simulateNegative?: boolean) => Promise<void>;
  onSimulateBranchB: () => Promise<void>;
  onExecuteCustomAction: (execution: CustomSandboxExecutionPayload) => Promise<void>;
  onResetWorkspace: () => Promise<void>;
  onRefreshData: () => Promise<void>;
}

const DEFAULT_RAW_SOW = `Project: Acme Global Enterprise Cloud & ERP Migration
Client: Acme Global Ventures LLC
Phase 1: Cloud Infrastructure & High-Availability Plan - $1,250.00
Phase 2: Custom PayPal ERP Reconciliation Module - $1,750.00
Phase 3: Production SOC2 Audit & Final Sign-Off - $1,500.00`;

const DEFAULT_MILESTONES: CustomSowMilestone[] = [
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
];

export const DemoControlsDrawer: React.FC<DemoControlsDrawerProps> = ({
  isOpen,
  onClose,
  milestones,
  executingStep,
  stepStatusMap,
  busyAction,
  onExecuteStep,
  onSimulateBranchB,
  onExecuteCustomAction,
  onResetWorkspace,
  onRefreshData,
}) => {
  const [sandboxTab, setSandboxTab] = useState<'sow' | 'deliverable' | 'dispute'>('sow');
  const [simulateNegative, setSimulateNegative] = useState(false);
  const [isJsonExpanded, setIsJsonExpanded] = useState(true);
  const [copiedJson, setCopiedJson] = useState(false);
  const [guardrailNoticeBanner, setGuardrailNoticeBanner] = useState<string | null>(null);

  // SOW state
  const [sowMode, setSowMode] = useState<'structured' | 'raw'>('structured');
  const [projectName, setProjectName] = useState(
    'Acme Global — Enterprise Cloud & ERP Migration'
  );
  const [clientName, setClientName] = useState('Acme Global Ventures LLC');
  const [sowMilestones, setSowMilestones] = useState<CustomSowMilestone[]>(DEFAULT_MILESTONES);
  const [rawSowText, setRawSowText] = useState(DEFAULT_RAW_SOW);

  // Deliverable state
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

  // Dispute state
  const [salesCount, setSalesCount] = useState<number>(211);
  const [disputeCount, setDisputeCount] = useState<number>(3);
  const [disputeAmount, setDisputeAmount] = useState<number>(350);

  useEffect(() => {
    if (milestones.length > 0 && !milestones.some((m) => m.id === selectedMilestoneId)) {
      setSelectedMilestoneId(milestones[0].id);
    }
  }, [milestones, selectedMilestoneId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const rawSowValidation = useMemo(() => {
    if (!rawSowText || rawSowText.trim().length < 8) return { isGibberish: true };
    const hasKeyword = /milestone|phase|\d+[\.\):]/i.test(rawSowText);
    const hasAmount = /\$|\busd\b/i.test(rawSowText);
    return { isGibberish: !hasKeyword && !hasAmount };
  }, [rawSowText]);

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

  const livePayloadPreview = useMemo(() => {
    if (sandboxTab === 'sow') {
      if (sowMode === 'raw') {
        return {
          endpoint: '/api/demo/fixtures/seed-contract',
          method: 'POST',
          payload: {
            rawSowText,
            guardrail: rawSowValidation.isGibberish
              ? 'Fallback parser synthesizes single $100.00 milestone'
              : 'Natural language parser active',
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
    }

    if (sandboxTab === 'deliverable') {
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
        },
      };
    }

    const safeAmt = disputeMetrics.isAmountNonPositive ? 10.0 : disputeAmount;
    return {
      endpoint: '/api/demo/fixtures/simulate-dispute',
      method: 'POST',
      payload: {
        salesCount: disputeMetrics.rawSales,
        disputeCount: disputeMetrics.effectiveDisputes,
        computedRatio: (disputeMetrics.effectiveRatio * 100).toFixed(2) + '%',
        clamped: disputeMetrics.isOutOfBounds,
        disputeAmount: safeAmt.toFixed(2),
      },
    };
  }, [
    sandboxTab,
    sowMode,
    rawSowText,
    rawSowValidation,
    projectName,
    clientName,
    sowMilestones,
    selectedMilestoneId,
    productTitle,
    customSku,
    fileName,
    fileSize,
    fileSha256,
    disputeMetrics,
    disputeAmount,
  ]);

  const handleResetDefaults = () => {
    setProjectName('Acme Global — Enterprise Cloud & ERP Migration');
    setClientName('Acme Global Ventures LLC');
    setSowMilestones(DEFAULT_MILESTONES.map((m) => ({ ...m })));
    setRawSowText(DEFAULT_RAW_SOW);
  };

  const handleFileChange = async (file: File) => {
    setFileName(file.name);
    setFileSize(`${Math.max(1, Math.round(file.size / 1024))} KB`);
    try {
      const hex = await computeFileSha256Hex(file);
      setFileSha256(hex);
    } catch {
      setFileSha256(
        Array.from(new Uint8Array(32))
          .map(() => Math.floor(Math.random() * 16).toString(16))
          .join('')
      );
    }
  };

  const handleExecuteSow = async () => {
    if (sowMode === 'raw') {
      const guardrailNotice = rawSowValidation.isGibberish
        ? 'Fallback parser active: unrecognized SOW structure will synthesize a single $100.00 milestone.'
        : undefined;
      setGuardrailNoticeBanner(guardrailNotice ?? null);
      await onExecuteCustomAction({
        actionType: 'SEED_CONTRACT',
        payload: { rawSowText },
        summary: 'Custom Raw SOW Seed',
        guardrailNotice,
      });
    } else {
      let normalizedCount = 0;
      const sanitizedMilestones = sowMilestones.map((m) => {
        const val = parseFloat(String(m.amount));
        const safeVal = isNaN(val) || val <= 0 ? 10.0 : val;
        if (isNaN(val) || val <= 0) normalizedCount += 1;
        return {
          id: m.id,
          name: m.name,
          description: m.description,
          amount: { currency_code: 'USD', value: safeVal.toFixed(2) },
        };
      });
      const guardrailNotice =
        normalizedCount > 0
          ? `${normalizedCount} milestone amount${normalizedCount > 1 ? 's were' : ' was'} normalized to the $10.00 minimum fallback.`
          : undefined;
      setGuardrailNoticeBanner(guardrailNotice ?? null);
      await onExecuteCustomAction({
        actionType: 'SEED_CONTRACT',
        payload: {
          customProject: { name: projectName, clientName },
          customMilestones: sanitizedMilestones,
        },
        summary: 'Custom Structured Contract Seed',
        guardrailNotice,
      });
    }
  };

  const handleExecuteDeliverable = async () => {
    setGuardrailNoticeBanner(null);
    await onExecuteCustomAction({
      actionType: 'VERIFY_DELIVERABLE',
      payload: {
        milestoneId: selectedMilestoneId,
        customTitle: productTitle,
        customSku,
        fileName,
      },
      summary: 'Custom Deliverable Verification',
    });
  };

  const handleExecuteDispute = async () => {
    const safeAmt = disputeMetrics.isAmountNonPositive ? 10.0 : disputeAmount;
    const notices: string[] = [];
    if (disputeMetrics.isOutOfBounds) {
      notices.push('Dispute count exceeded sales volume and was clamped to 100.00%.');
    }
    if (disputeMetrics.isAmountNonPositive) {
      notices.push('Non-positive claim amount was normalized to $10.00.');
    }
    const guardrailNotice = notices.length > 0 ? notices.join(' ') : undefined;
    setGuardrailNoticeBanner(guardrailNotice ?? null);
    await onExecuteCustomAction({
      actionType: 'SIMULATE_DISPUTE',
      payload: {
        salesCount: disputeMetrics.rawSales,
        disputeCount: disputeMetrics.effectiveDisputes,
        disputeAmount: safeAmt.toFixed(2),
      },
      summary: 'Custom Dispute Ratio Simulation',
      guardrailNotice,
    });
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(livePayloadPreview, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  if (!isOpen) return null;

  const stepperButtons: Array<{ id: StepId; label: string }> = [
    { id: 1, label: '1. Seed' },
    { id: 2, label: '2. Fast-forward' },
    { id: 3, label: '3. Verify' },
    { id: 4, label: '4. Simulate dispute' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1C1917]/40 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <aside
        aria-label="Demo Controls Panel"
        className="bg-white w-full max-w-2xl h-full shadow-2xl border-l border-[#E5E0D8] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E0D8] flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#1C1917]">Demo Controls</h2>
            <p className="text-[11px] text-[#57534E]">
              Compact workflow triggers, reset controls, and custom input playground
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshData}
              disabled={!!busyAction}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D8] inline-flex items-center gap-1"
              title="Refresh data"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={onResetWorkspace}
              disabled={busyAction === 'reset'}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-red-50 text-red-700 border border-red-200"
            >
              {busyAction === 'reset' ? 'Resetting...' : 'Reset workspace'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Demo Controls"
              className="p-1.5 rounded-lg text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F1EA]"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Compact Stepper Buttons */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716C]">
                Guided Demo Actions
              </h3>
              <label
                htmlFor="demo-simulate-negative"
                className="inline-flex items-center gap-1.5 text-[11px] text-[#57534E] cursor-pointer"
              >
                <input
                  id="demo-simulate-negative"
                  name="demoSimulateNegative"
                  type="checkbox"
                  checked={simulateNegative}
                  onChange={(e) => setSimulateNegative(e.target.checked)}
                  className="accent-[#0070BA]"
                />
                <span>Day-3 issuer decline test</span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {stepperButtons.map((btn) => {
                const info = stepStatusMap[btn.id];
                const isRunning = executingStep === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    disabled={!!executingStep}
                    onClick={() =>
                      onExecuteStep(btn.id, btn.id === 2 ? simulateNegative : false)
                    }
                    className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between gap-1.5 disabled:opacity-50 ${
                      isRunning
                        ? 'bg-[#E6F2FA] border-[#0070BA] text-[#0070BA]'
                        : info?.status === 'SUCCESS'
                        ? 'bg-[#F9F8F5] border-emerald-300 text-[#1C1917]'
                        : 'bg-white hover:bg-[#F9F8F5] border-[#E5E0D8] text-[#1C1917]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <PlayIcon className="w-3.5 h-3.5 text-[#0070BA]" />
                      {info?.status === 'SUCCESS' && (
                        <span className="text-[10px] font-mono text-emerald-700 font-semibold">
                          {info.statusCode || 200}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold leading-tight">{btn.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={busyAction === 'simulate-branch-b'}
              onClick={onSimulateBranchB}
              className="w-full px-3 py-2 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <ShieldExclamationIcon className="w-4 h-4 text-amber-700" />
              <span>Simulate Branch B (Escalated Chargeback)</span>
            </button>
          </div>

          {/* Custom Input Sandbox (3 Tabs) */}
          <div className="border-t border-[#E5E0D8] pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716C]">
                Custom Sandbox Inputs
              </h3>
              {sandboxTab === 'sow' && (
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="text-[11px] font-semibold text-[#57534E] hover:text-[#1C1917] inline-flex items-center gap-1"
                >
                  <ArrowPathIcon className="w-3 h-3" />
                  <span>Reset defaults</span>
                </button>
              )}
            </div>

            {/* Sandbox Tabs */}
            <div className="flex border-b border-[#E5E0D8] space-x-2">
              {[
                { id: 'sow' as const, label: 'SOW' },
                { id: 'deliverable' as const, label: 'Deliverable / SKU' },
                { id: 'dispute' as const, label: 'Dispute ratio' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSandboxTab(t.id)}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${
                    sandboxTab === t.id
                      ? 'border-[#0070BA] text-[#0070BA]'
                      : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {guardrailNoticeBanner && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 text-xs text-amber-900">
                  <ExclamationTriangleIcon className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>{guardrailNoticeBanner}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGuardrailNoticeBanner(null)}
                  className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Tab 1: SOW */}
            {sandboxTab === 'sow' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
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
                    type="button"
                    onClick={() => setSowMode('raw')}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium border ${
                      sowMode === 'raw'
                        ? 'bg-[#0070BA] text-white border-[#0070BA]'
                        : 'bg-white text-[#57534E] border-[#E5E0D8]'
                    }`}
                  >
                    Raw SOW Text
                  </button>
                </div>

                {sowMode === 'structured' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="demo-sow-project-name"
                          className="block text-[11px] font-semibold text-[#57534E] mb-1"
                        >
                          Project Name
                        </label>
                        <input
                          id="demo-sow-project-name"
                          name="demoSowProjectName"
                          type="text"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="demo-sow-client-name"
                          className="block text-[11px] font-semibold text-[#57534E] mb-1"
                        >
                          Client Organization
                        </label>
                        <input
                          id="demo-sow-client-name"
                          name="demoSowClientName"
                          type="text"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5]"
                        />
                      </div>
                    </div>

                    {sowMilestones.map((m, idx) => {
                      const val = parseFloat(String(m.amount));
                      const invalid = isNaN(val) || val <= 0;
                      return (
                        <div
                          key={m.id}
                          className="p-3 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5] space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <input
                              id={`demo-sow-milestone-name-${idx}`}
                              name={`demoSowMilestoneName_${idx}`}
                              aria-label={`Milestone ${idx + 1} name`}
                              type="text"
                              value={m.name}
                              onChange={(e) => {
                                const next = [...sowMilestones];
                                next[idx] = { ...next[idx], name: e.target.value };
                                setSowMilestones(next);
                              }}
                              className="flex-1 text-xs font-semibold px-2 py-1 rounded border border-[#E5E0D8] bg-white"
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-[#57534E]">$</span>
                              <input
                                id={`demo-sow-milestone-amount-${idx}`}
                                name={`demoSowMilestoneAmount_${idx}`}
                                aria-label={`Milestone ${idx + 1} USD amount`}
                                type="number"
                                step="10"
                                value={m.amount}
                                onChange={(e) => {
                                  const next = [...sowMilestones];
                                  next[idx] = { ...next[idx], amount: e.target.value };
                                  setSowMilestones(next);
                                }}
                                className={`w-24 text-xs font-mono px-2 py-1 rounded border text-right ${
                                  invalid
                                    ? 'border-amber-400 bg-amber-50'
                                    : 'border-[#E5E0D8] bg-white'
                                }`}
                              />
                            </div>
                          </div>
                          <input
                            id={`demo-sow-milestone-desc-${idx}`}
                            name={`demoSowMilestoneDesc_${idx}`}
                            aria-label={`Milestone ${idx + 1} description`}
                            type="text"
                            value={m.description}
                            onChange={(e) => {
                              const next = [...sowMilestones];
                              next[idx] = { ...next[idx], description: e.target.value };
                              setSowMilestones(next);
                            }}
                            className="w-full text-xs px-2 py-1 rounded border border-[#E5E0D8] bg-white text-[#57534E]"
                          />
                          {invalid && (
                            <p className="text-[11px] text-amber-800 font-medium">
                              Non-positive amount falls back to minimum $10.00 USD.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      id="demo-sow-raw-text"
                      name="demoSowRawText"
                      aria-label="Raw statement of work text"
                      rows={5}
                      value={rawSowText}
                      onChange={(e) => setRawSowText(e.target.value)}
                      className="w-full text-xs font-mono p-3 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5]"
                    />
                    {rawSowValidation.isGibberish && (
                      <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                        <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                        <span>
                          Malformed text falls back to a single generic milestone at $100.00 USD.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!!executingStep || !!busyAction}
                  onClick={handleExecuteSow}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white disabled:opacity-50"
                >
                  Execute Custom Seed &amp; Hold
                </button>
              </div>
            )}

            {/* Tab 2: Deliverable / SKU */}
            {sandboxTab === 'deliverable' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="demo-deliverable-title"
                      className="block text-[11px] font-semibold text-[#57534E] mb-1"
                    >
                      Deliverable Title (default: Industrial Edge Router SKU-9921)
                    </label>
                    <input
                      id="demo-deliverable-title"
                      name="demoDeliverableTitle"
                      type="text"
                      value={productTitle}
                      onChange={(e) => setProductTitle(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="demo-deliverable-sku"
                      className="block text-[11px] font-semibold text-[#57534E] mb-1"
                    >
                      Catalog SKU (default: CH3-TECH-88921)
                    </label>
                    <input
                      id="demo-deliverable-sku"
                      name="demoDeliverableSku"
                      type="text"
                      value={customSku}
                      onChange={(e) => setCustomSku(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="demo-target-milestone"
                    className="block text-[11px] font-semibold text-[#57534E] mb-1"
                  >
                    Target Milestone
                  </label>
                  <select
                    id="demo-target-milestone"
                    name="demoTargetMilestone"
                    value={selectedMilestoneId}
                    onChange={(e) => setSelectedMilestoneId(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5]"
                  >
                    {milestones.length > 0 ? (
                      milestones.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (${m.amount.value} {m.amount.currency_code})
                        </option>
                      ))
                    ) : (
                      <option value="m1-cloud-arch">
                        Milestone 1: Cloud Infrastructure ($1250.00 USD)
                      </option>
                    )}
                  </select>
                </div>

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
                  }}
                  className="border-2 border-dashed border-[#E5E0D8] rounded-xl p-4 bg-[#F9F8F5] text-center relative cursor-pointer hover:border-[#0070BA]"
                >
                  <input
                    id="demo-deliverable-file"
                    name="demoDeliverableFile"
                    aria-label="Upload custom deliverable file"
                    type="file"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <CloudArrowUpIcon className="w-7 h-7 text-[#0070BA] mx-auto mb-1" />
                  <p className="text-xs font-semibold text-[#1C1917]">
                    {fileName} <span className="text-[#57534E] font-normal">({fileSize})</span>
                  </p>
                  <p className="text-[10px] font-mono text-[#78716C] mt-1">
                    SHA-256: {fileSha256.slice(0, 28)}...
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!!executingStep || !!busyAction}
                  onClick={handleExecuteDeliverable}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircleIcon className="w-4 h-4" />
                  <span>Execute Custom Deliverable Verification</span>
                </button>
              </div>
            )}

            {/* Tab 3: Dispute Ratio */}
            {sandboxTab === 'dispute' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5] space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <label htmlFor="demo-dispute-sales" className="font-semibold">
                        90-Day Sales
                      </label>
                      <span className="font-mono font-bold text-[#0070BA]">{salesCount}</span>
                    </div>
                    <input
                      id="demo-dispute-sales"
                      name="demoDisputeSales"
                      type="range"
                      min="10"
                      max="500"
                      value={salesCount}
                      onChange={(e) => setSalesCount(parseInt(e.target.value, 10))}
                      className="w-full accent-[#0070BA]"
                    />
                    <div className="flex justify-between text-[10px] text-[#78716C]">
                      <span>10</span>
                      <span>Default: 211</span>
                      <span>500</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5] space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <label htmlFor="demo-dispute-count" className="font-semibold">
                        Dispute Count
                      </label>
                      <span className="font-mono font-bold text-amber-700">{disputeCount}</span>
                    </div>
                    <input
                      id="demo-dispute-count"
                      name="demoDisputeCount"
                      type="range"
                      min="0"
                      max="20"
                      value={disputeCount}
                      onChange={(e) => setDisputeCount(parseInt(e.target.value, 10))}
                      className="w-full accent-amber-600"
                    />
                    <div className="flex justify-between text-[10px] text-[#78716C]">
                      <span>0</span>
                      <span>Default: 3 (1.42%)</span>
                      <span>20</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5] text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Computed Ratio:</span>
                    <span className="font-mono font-bold">
                      {(disputeMetrics.effectiveRatio * 100).toFixed(2)}% (
                      {disputeMetrics.isHighRisk ? 'Branch B · High Risk' : 'Branch A · Safe Tier'}
                      )
                    </span>
                  </div>
                  {disputeMetrics.isOutOfBounds && (
                    <p className="text-[11px] text-amber-800">
                      Dispute count exceeded sales; clamped cleanly to 100.00%.
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="demo-dispute-amount"
                    className="block text-[11px] font-semibold text-[#57534E] mb-1"
                  >
                    Claim Amount ($ USD · default 350, min fallback 10)
                  </label>
                  <input
                    id="demo-dispute-amount"
                    name="demoDisputeAmount"
                    type="number"
                    step="10"
                    value={disputeAmount}
                    onChange={(e) => setDisputeAmount(parseFloat(e.target.value) || 0)}
                    className="w-40 text-xs font-mono px-3 py-1.5 rounded-lg border border-[#E5E0D8] bg-[#F9F8F5]"
                  />
                  {disputeMetrics.isAmountNonPositive && (
                    <p className="text-[11px] text-amber-800 mt-1">
                      Value must be positive; normalized to $10.00.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!!executingStep || !!busyAction}
                  onClick={handleExecuteDispute}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0070BA] hover:bg-[#005EA6] text-white disabled:opacity-50"
                >
                  Execute Custom Dispute Simulation
                </button>
              </div>
            )}

            {/* Collapsible Live Payload JSON Preview */}
            <div className="pt-2 border-t border-[#E5E0D8]">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsJsonExpanded((p) => !p)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1C1917] hover:text-[#0070BA]"
                >
                  <span>Live Payload Preview</span>
                  {isJsonExpanded ? (
                    <ChevronUpIcon className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDownIcon className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1 text-[11px] text-[#57534E] hover:text-[#1C1917]"
                >
                  {copiedJson ? (
                    <>
                      <ClipboardDocumentCheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <ClipboardIcon className="w-3.5 h-3.5" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>

              {isJsonExpanded && (
                <pre className="mt-2 p-3 rounded-lg bg-[#1C1917] text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(livePayloadPreview, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default DemoControlsDrawer;
