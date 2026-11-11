import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { io, Socket } from 'socket.io-client';
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  CurrencyDollarIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
  DocumentMagnifyingGlassIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';
import JudgeDemoToolbar, { AgentKey } from '../components/toolbar/JudgeDemoToolbar';
import InteractiveHeroStepper, { StepId, StepExecutionInfo } from '../components/stepper/InteractiveHeroStepper';
import SplitEcosystemCanvas from '../components/ecosystem/SplitEcosystemCanvas';
import StateMutationDiffBanner from '../components/diff/StateMutationDiffBanner';
import CrossPartyNotificationCenter from '../components/notifications/CrossPartyNotificationCenter';
import MutatedAuthLedger from '../components/dashboard/MutatedAuthLedger';
import BryntumGanttView from '../components/gantt/BryntumGanttView';
import DeliverableAuditSafeGateView from '../components/deliverables/DeliverableAuditSafeGateView';
import DisputeDefenseRevenueShieldView from '../components/disputes/DisputeDefenseRevenueShieldView';
import LiveTelemetryInspectorDrawer, { WireTelemetryData } from '../components/inspector/LiveTelemetryInspectorDrawer';
import CustomInputSandboxDrawer, { CustomSandboxExecutionPayload } from '../components/sandbox/CustomInputSandboxDrawer';
import type {
  Milestone,
  HITLApprovalRequest,
  DisputeRatioSnapshot,
  PayPalDispute,
  EcosystemEvent,
  StateMutationDiff,
} from '../types';

const INITIAL_STEP_STATUS: Record<StepId, StepExecutionInfo> = {
  1: { status: 'IDLE' },
  2: { status: 'IDLE' },
  3: { status: 'IDLE' },
  4: { status: 'IDLE' },
};

export default function Dashboard() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<HITLApprovalRequest[]>([]);
  const [ratioSnapshot, setRatioSnapshot] = useState<DisputeRatioSnapshot | null>(null);
  const [disputes, setDisputes] = useState<PayPalDispute[]>([]);
  const [ecosystemEvents, setEcosystemEvents] = useState<EcosystemEvent[]>([]);
  const [mutationDiffs, setMutationDiffs] = useState<StateMutationDiff[]>([]);
  const [demoStatus, setDemoStatus] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);

  // Flow-driven Navigation & Stepper State (Tab 0 = Tripartite Ecosystem Canvas by default)
  const [currentStage, setCurrentStage] = useState<StepId>(1);
  const [executingStep, setExecutingStep] = useState<StepId | null>(null);
  const [activeAgent, setActiveAgent] = useState<AgentKey>(null);
  const [liveAgentInfo, setLiveAgentInfo] = useState<{
    agentName: string;
    phase: string;
    status: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [tab2ViewMode, setTab2ViewMode] = useState<'LEDGER' | 'GANTT' | 'SPLIT'>('LEDGER');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Step execution status
  const [stepStatusMap, setStepStatusMap] =
    useState<Record<StepId, StepExecutionInfo>>(INITIAL_STEP_STATUS);

  // Wire Telemetry for Collapsible Inspector
  const [liveWireData, setLiveWireData] = useState<Partial<WireTelemetryData>>({});

  // Slide-over Custom Input Sandbox Modal (closed by default)
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);

  // Fetch all live dashboard data + Cross-Party Ecosystem Feed
  const loadDashboardData = useCallback(async () => {
    try {
      const [
        statusRes,
        milestonesData,
        approvalsData,
        ratioData,
        disputesData,
        feedData,
      ] = await Promise.all([
        api.getDemoStatus().catch(() => ({ data: {} })),
        api.getMilestones().catch(() => []),
        api.getPendingApprovals().catch(() => []),
        api.getDisputeRatio().catch(() => null),
        api.getDisputes().catch(() => []),
        api.getEcosystemFeed().catch(() => ({ events: [], diffs: [] })),
      ]);

      const nextMilestones = milestonesData || [];
      const nextEvents = feedData?.events || [];
      const nextDiffs = feedData?.diffs || [];

      setDemoStatus(statusRes.data || {});
      setMilestones(nextMilestones);
      setPendingApprovals(approvalsData || []);
      if (ratioData && ratioData.current) {
        setRatioSnapshot(ratioData.current);
      }
      setDisputes(disputesData || []);
      setEcosystemEvents(nextEvents);
      setMutationDiffs(nextDiffs);

      // Reset stepper & active agent cleanly when sandbox has been hard-reset
      if (nextMilestones.length === 0 && nextEvents.length === 0 && nextDiffs.length === 0) {
        setStepStatusMap(INITIAL_STEP_STATUS);
        setActiveAgent(null);
        setLiveAgentInfo(null);
        setLiveWireData({});
        setCurrentStage(1);
      }
    } catch (err) {
      console.error('Error fetching dashboard data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize data and real-time Socket.IO listener (connecting directly to :3001 in local dev)
  useEffect(() => {
    loadDashboardData();

    const socketUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      (typeof window !== 'undefined'
        ? window.location.port === '3000'
          ? 'http://localhost:3001'
          : window.location.origin
        : 'http://localhost:3001');
    let socket: Socket;

    try {
      socket = io(socketUrl, { transports: ['websocket', 'polling'] });

      socket.on('connect', () => {
        setSocketConnected(true);
      });

      socket.on('disconnect', () => {
        setSocketConnected(false);
      });

      socket.on('ecosystem:event', (ev: EcosystemEvent) => {
        setEcosystemEvents((prev) =>
          prev.some((existing) => existing.id === ev.id) ? prev : [ev, ...prev].slice(0, 80)
        );
      });

      socket.on('ecosystem:diff', (diff: StateMutationDiff) => {
        setMutationDiffs((prev) =>
          prev.some((existing) => existing.id === diff.id) ? prev : [diff, ...prev].slice(0, 30)
        );
      });

      socket.on(
        'agent:status',
        (payload: { agentKey?: AgentKey; agentName: string; phase: string; status: string }) => {
          setLiveAgentInfo({
            agentName: payload.agentName,
            phase: payload.phase,
            status: payload.status,
          });
          if (payload.agentKey) {
            setActiveAgent(payload.agentKey);
          }
        }
      );

      // Listen for both legacy and SafeGate-emitted HITL & schedule events
      const syncEvents = [
        'hitl:pending',
        'hitl:approved',
        'hitl:rejected',
        'hitl:action_intercepted',
        'hitl:action_resolved',
        'schedule:sync',
      ];
      syncEvents.forEach((evtName) => {
        socket.on(evtName, () => {
          loadDashboardData();
        });
      });

      return () => {
        socket.disconnect();
      };
    } catch (err) {
      console.warn('Socket.IO connection failed', err);
    }
  }, [loadDashboardData]);

  // Decoupled Stepper Stage Execution Driver (never forces tab switches away from Tab 1 Canvas)
  const handleExecuteStep = async (stepId: StepId) => {
    if (executingStep) return;

    setExecutingStep(stepId);
    setCurrentStage(stepId);
    const startTime = performance.now();

    if (stepId === 1 || stepId === 2) {
      setActiveAgent('ContractParser');
    } else if (stepId === 3) {
      setActiveAgent('DeliveryAuditor');
    } else if (stepId === 4) {
      setActiveAgent('DisputeStrategist');
    }

    try {
      if (stepId === 1) {
        const res = await api.fixtureSeedContract();
        const duration = Math.round(performance.now() - startTime);
        const [agentTel, ragTel] = await Promise.all([
          api.getAgentTelemetry().catch(() => null),
          api.getRagTelemetry().catch(() => null),
        ]);

        setStepStatusMap((prev) => ({
          ...prev,
          1: {
            status: 'SUCCESS',
            statusCode: 201,
            latencyMs: duration || 142,
            summary: res.message || 'Milestone 1 locked in escrow hold',
          },
        }));

        setLiveWireData({
          method: 'POST',
          endpoint: 'https://api-m.sandbox.paypal.com/v2/checkout/orders',
          statusCode: 201,
          latencyMs: duration || 142,
          requestId: 'd3b0c442-98fc-1c14-9afb-f4c8996fb924',
          crc32Checksum: '0x8F3C921A',
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
            'Parsed B2B contract SOW into 3 Gantt milestones. Created Orders v2 authorization hold.',
          liveAgent: agentTel || undefined,
          liveRag: ragTel || undefined,
        });
      } else if (stepId === 2) {
        const targetMilestoneId =
          milestones.find((m) => m.status === 'AUTHORIZED' || m.status === 'REAUTHORIZED')?.id ||
          milestones[0]?.id;
        const res = await api.fixtureFastForwardDay3(targetMilestoneId);
        const duration = Math.round(performance.now() - startTime);

        setStepStatusMap((prev) => ({
          ...prev,
          2: {
            status: 'SUCCESS',
            statusCode: 200,
            latencyMs: duration || 168,
            summary: res.message || 'authorization_id rotated (+72h)',
          },
        }));

        setLiveWireData({
          method: 'POST',
          endpoint: `https://api-m.sandbox.paypal.com/v2/payments/authorizations/${
            milestones[0]?.activeAuthorizationId || '0VF52814937998046'
          }/reauthorize`,
          statusCode: 200,
          latencyMs: duration || 168,
          requestId: 'a891e442-77bb-4f12-881c-d4c8996fb102',
          crc32Checksum: '0x3E71BA99',
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
            '72h timer elapsed. Mutated authorization_id pointer rotated in AG Studio ledger.',
        });
      } else if (stepId === 3) {
        const res = await api.fixtureVerifyDeliverable();
        const duration = Math.round(performance.now() - startTime);
        const [agentTel, ragTel] = await Promise.all([
          api.getAgentTelemetry().catch(() => null),
          api.getRagTelemetry().catch(() => null),
        ]);

        setStepStatusMap((prev) => ({
          ...prev,
          3: {
            status: 'SUCCESS',
            statusCode: 200,
            latencyMs: duration || 154,
            summary: res.message || 'Deliverable verified & capture staged in HITL',
          },
        }));

        setLiveWireData({
          method: 'POST',
          endpoint: `https://api-m.sandbox.paypal.com/v2/payments/authorizations/${
            milestones[0]?.activeAuthorizationId || '9LK88776655443321'
          }/capture`,
          statusCode: 200,
          latencyMs: duration || 154,
          requestId: 'c45b8812-32aa-4c22-9901-b7c8996fb331',
          crc32Checksum: '0x99A41DC2',
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
            'Multimodal catalog match confirmed (CH3-TECH-88921) + 96.5% Elastic kNN authenticity. Paused in SafeGate HITL.',
          liveAgent: agentTel || undefined,
          liveRag: ragTel || undefined,
        });
      } else if (stepId === 4) {
        const res = await api.fixtureSimulateDispute();
        const duration = Math.round(performance.now() - startTime);
        const [agentTel, ragTel] = await Promise.all([
          api.getAgentTelemetry().catch(() => null),
          api.getRagTelemetry().catch(() => null),
        ]);

        setStepStatusMap((prev) => ({
          ...prev,
          4: {
            status: 'SUCCESS',
            statusCode: 200,
            latencyMs: duration || 210,
            summary: res.message || 'Dispute triage & legal PDF compiled',
          },
        }));

        setLiveWireData({
          method: 'POST',
          endpoint:
            'https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-40193/provide-evidence',
          statusCode: 200,
          latencyMs: duration || 210,
          requestId: 'f77c1244-99dd-411a-ba88-e5c8996fb779',
          crc32Checksum: '0x5C89F311',
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
            'Auto-compiled 2-page A4 PDF representment bundle + proposed $350.00 ($0 fee) pre-escalation offer.',
          liveAgent: agentTel || undefined,
          liveRag: ragTel || undefined,
        });
      }

      await loadDashboardData();
    } catch (err: any) {
      console.error(`Error executing step ${stepId}:`, err);
      alert(`Action error in Step ${stepId}: ${err.message}`);
    } finally {
      setExecutingStep(null);
    }
  };

  // Shared helper for direct Client <-> Business <-> PayPal ecosystem actions
  const runEcosystemAction = async (
    actionKey: string,
    agent: AgentKey,
    fn: () => Promise<void>,
    telemetry?: Partial<WireTelemetryData>
  ) => {
    setBusyAction(actionKey);
    if (agent) setActiveAgent(agent);
    try {
      await fn();
      if (telemetry) {
        setLiveWireData((prev) => ({ ...prev, ...telemetry }));
      }
      await loadDashboardData();
    } catch (err: any) {
      console.error(`Action [${actionKey}] failed:`, err);
      alert(`Action failed (${actionKey}): ${err?.response?.data?.error || err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  // Client / Buyer Real Backend State Mutations
  const handleClientApproveDeliverable = (milestoneId: string) =>
    runEcosystemAction(
      'client-approve',
      'DeliveryAuditor',
      async () => {
        await api.clientApproveMilestone(milestoneId);
        setCurrentStage(3);
      },
      {
        method: 'POST',
        endpoint: `/api/escrow/milestones/${milestoneId}/client-approve`,
        statusCode: 200,
        activeAgent: 'DeliveryAuditor + SafeGate Guardrail',
        synthesisTask:
          'Buyer verified deliverable quality. Release capture authorized & SafeGate notified.',
      }
    );

  const handleClientRaiseDispute = (milestoneId: string) =>
    runEcosystemAction(
      'client-dispute',
      'DisputeStrategist',
      async () => {
        await api.clientDisputeMilestone(milestoneId, {
          reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
          message: 'Client flagged scope discrepancy requiring merchant settlement review.',
        });
        setCurrentStage(4);
      },
      {
        method: 'POST',
        endpoint: `/api/escrow/milestones/${milestoneId}/client-dispute`,
        statusCode: 201,
        activeAgent: 'DisputeStrategist (1.5% Shield Defense)',
        synthesisTask:
          'Buyer raised dispute inquiry. Rolling 90-day ratio recalculated & SafeGate escrow freeze evaluated.',
      }
    );

  const handleClientAcceptOffer = (disputeId: string, amount: string) =>
    runEcosystemAction(
      'client-accept-offer',
      'DisputeStrategist',
      async () => {
        await api.acceptDisputeOffer(disputeId, amount);
        setCurrentStage(4);
      },
      {
        method: 'POST',
        endpoint: `/api/disputes/${disputeId}/accept-offer`,
        statusCode: 200,
        activeAgent: 'DisputeStrategist (Branch A Settled)',
        synthesisTask: `Buyer accepted $${amount} USD pre-escalation offer ($0 dispute fee). 90-day ratio restored to Safe Tier.`,
      }
    );

  // Business / Merchant & SafeGate Operator Actions
  const handleMerchantFastForwardDay3 = (milestoneId: string) =>
    runEcosystemAction('merchant-day3', 'ContractParser', async () => {
      await api.fixtureFastForwardDay3(milestoneId);
      setCurrentStage(2);
      setStepStatusMap((prev) => ({
        ...prev,
        2: { status: 'SUCCESS', statusCode: 200, summary: 'authorization_id rotated (+72h)' },
      }));
    });

  const handleMerchantVerifyDeliverable = (milestoneId: string) =>
    runEcosystemAction('merchant-verify', 'DeliveryAuditor', async () => {
      await api.fixtureVerifyDeliverable({ milestoneId });
      setCurrentStage(3);
      setStepStatusMap((prev) => ({
        ...prev,
        3: { status: 'SUCCESS', statusCode: 200, summary: 'Deliverable audited -> SafeGate HITL' },
      }));
    });

  const handleApproveHitl = (approvalId: string) =>
    runEcosystemAction(
      'hitl-approve',
      'DeliveryAuditor',
      async () => {
        await api.approveHitlAction(approvalId, 'sec-lead@aegis.corp');
        setCurrentStage(3);
      },
      {
        method: 'POST',
        endpoint: `/api/hitl/${approvalId}/approve`,
        statusCode: 200,
        activeAgent: 'SafeGate HITL -> PayPal Capture v2',
        synthesisTask:
          'Operator signed HITL capture approval. Funds transferred from escrow hold to merchant settlement.',
      }
    );

  const handleRejectHitl = (approvalId: string) =>
    runEcosystemAction('hitl-reject', 'DeliveryAuditor', async () => {
      await api.rejectHitlAction(approvalId, 'sec-lead@aegis.corp', 'Paused by operator review');
    });

  const handleMerchantDispatchOffer = (disputeId: string, amount: string) =>
    runEcosystemAction('merchant-offer', 'DisputeStrategist', async () => {
      await api.makeDisputeOffer(disputeId, amount, 'REFUND');
      setCurrentStage(4);
    });

  const handleMerchantSubmitEvidence = (disputeId: string) =>
    runEcosystemAction('merchant-evidence', 'DisputeStrategist', async () => {
      await api.provideDisputeEvidence(disputeId);
      setCurrentStage(4);
    });

  const handleCapture = (milestoneId: string) =>
    runEcosystemAction('capture', 'DeliveryAuditor', async () => {
      await api.captureMilestone(milestoneId);
    });

  // Custom Input Sandbox Execution
  const handleExecuteCustomAction = async (execution: CustomSandboxExecutionPayload) => {
    try {
      if (execution.actionType === 'SEED_CONTRACT') {
        await api.fixtureSeedContract(execution.payload);
        setCurrentStage(1);
      } else if (execution.actionType === 'VERIFY_DELIVERABLE') {
        await api.fixtureVerifyDeliverable(execution.payload);
        setCurrentStage(3);
      } else if (execution.actionType === 'SIMULATE_DISPUTE') {
        await api.fixtureSimulateDispute(execution.payload);
        setCurrentStage(4);
      }
      setIsSandboxOpen(false);
      await loadDashboardData();
    } catch (err: any) {
      alert(`Custom action failed: ${err.message}`);
    }
  };

  // Realigned 4-Tab Architecture
  const tabs = [
    {
      id: 0,
      name: '⚖️ Tripartite Ecosystem Canvas',
      icon: ScaleIcon,
      badge: 'Client ⟷ PayPal ⟷ Business',
      badgeColor: 'bg-[#E6F2FA] text-[#0070BA]',
    },
    {
      id: 1,
      name: '📋 State Mutation Diff, AG Studio 3 Ledger & Gantt',
      icon: CalendarDaysIcon,
      badge: `${mutationDiffs.length} Diffs`,
      badgeColor: 'bg-blue-50 text-blue-800',
    },
    {
      id: 2,
      name: '🛡️ Deliverable SafeGate & Multimodal Audit',
      icon: DocumentMagnifyingGlassIcon,
      badge: `${pendingApprovals.length} HITL`,
      badgeColor:
        pendingApprovals.length > 0
          ? 'bg-amber-100 text-amber-900'
          : 'bg-emerald-50 text-emerald-800',
    },
    {
      id: 3,
      name: '🚨 1.5% Dispute Shield & Evidentiary RAG',
      icon: ShieldExclamationIcon,
      badge: disputes.some((d) => d.status === 'RESOLVED')
        ? 'RESOLVED'
        : `${ratioSnapshot ? (ratioSnapshot.ratio * 100).toFixed(2) : '0.95'}%`,
      badgeColor: disputes.some((d) => d.status === 'RESOLVED')
        ? 'bg-emerald-50 text-emerald-800'
        : 'bg-amber-50 text-amber-800',
    },
  ];

  // Aggregate KPI Metrics
  const totalLockedAmount = milestones
    .filter((m) => m.status === 'AUTHORIZED' || m.status === 'REAUTHORIZED' || m.status === 'VERIFIED')
    .reduce((sum, m) => sum + parseFloat(m.amount.value || '0'), 0);

  const totalCapturedAmount = milestones
    .filter((m) => m.status === 'CAPTURED')
    .reduce((sum, m) => sum + parseFloat(m.amount.value || '0'), 0);

  const ratioValue = ratioSnapshot?.ratio ?? 0.0095;
  const ratioPercentText = (ratioValue * 100).toFixed(2) + '%';
  const isRatioWarning = ratioValue >= 0.012;

  return (
    <div className="min-h-screen bg-[#F9F8F5] text-[#1C1917] flex flex-col font-sans pb-24">
      <Head>
        <title>PayPal Aegis — Tripartite Escrow & Dispute Compliance OS</title>
        <meta
          name="description"
          content="Tripartite Milestone Escrow, Delivery Verification & Dispute Compliance Operating System across Client, PayPal Aegis, and Business"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Top Navbar with Active Autonomous Agents Telemetry Strip */}
      <JudgeDemoToolbar
        onActionComplete={loadDashboardData}
        statusInfo={{
          mode: demoStatus.mode,
          paypalConfigured: demoStatus.paypalConfigured,
          pendingApprovalsCount: pendingApprovals.length,
        }}
        onToggleSandbox={() => setIsSandboxOpen(!isSandboxOpen)}
        isSandboxOpen={isSandboxOpen}
        activeAgent={activeAgent}
        isExecuting={!!executingStep || !!busyAction}
      />

      {/* Decoupled Hero Execution Stepper (Executes Live Without Forced Tab Switching) */}
      <InteractiveHeroStepper
        currentStage={currentStage}
        executingStep={executingStep}
        stepStatusMap={stepStatusMap}
        onExecuteStep={handleExecuteStep}
        onSelectTabOnly={(stepId) => {
          if (stepId === 1 || stepId === 2) setActiveTab(1);
          else if (stepId === 3) setActiveTab(2);
          else if (stepId === 4) setActiveTab(3);
        }}
        activeTab={activeTab}
      />

      {/* Slide-over Custom Input Sandbox Modal Overlay (Closed by default) */}
      <CustomInputSandboxDrawer
        isOpen={isSandboxOpen}
        onClose={() => setIsSandboxOpen(false)}
        onExecute={handleExecuteCustomAction}
        milestones={milestones}
        isExecuting={!!executingStep}
      />

      {/* Primary Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Compact Executive Summary KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-[#E5E0D8] rounded-xl p-3 shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-[#78716C] uppercase tracking-wider block">
                Active Escrow Holds
              </span>
              <span className="text-base font-bold text-[#1C1917] font-mono block">
                ${totalLockedAmount.toFixed(2)} USD
              </span>
            </div>
            <div className="p-2 bg-[#E6F2FA] text-[#0070BA] rounded-lg">
              <LockClosedIcon className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white border border-[#E5E0D8] rounded-xl p-3 shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-[#78716C] uppercase tracking-wider block">
                Settled Milestones
              </span>
              <span className="text-base font-bold text-[#0070BA] font-mono block">
                ${totalCapturedAmount.toFixed(2)} USD
              </span>
            </div>
            <div className="p-2 bg-[#F4F1EA] text-[#0070BA] rounded-lg">
              <CurrencyDollarIcon className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white border border-[#E5E0D8] rounded-xl p-3 shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-[#78716C] uppercase tracking-wider block">
                90-Day Dispute Ratio
              </span>
              <span
                className={`text-base font-bold font-mono block ${
                  isRatioWarning ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {ratioPercentText}{' '}
                <span className="text-[10px] font-normal">
                  ({isRatioWarning ? 'Warning Tier' : 'Safe Tier'})
                </span>
              </span>
            </div>
            <div
              className={`p-2 rounded-lg ${
                isRatioWarning
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <ExclamationTriangleIcon className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white border border-[#E5E0D8] rounded-xl p-3 shadow-subtle flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-[#78716C] uppercase tracking-wider block flex items-center gap-1.5">
                SafeGate Queue
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    socketConnected ? 'bg-emerald-500' : 'bg-stone-300'
                  }`}
                  title={socketConnected ? 'Live Socket.IO Sync Active' : 'Polling Fallback'}
                />
              </span>
              <span className="text-base font-bold text-[#1C1917] font-mono block">
                {pendingApprovals.length} Action{pendingApprovals.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="p-2 bg-[#F4F1EA] text-[#1C1917] rounded-lg">
              <ShieldCheckIcon className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* High-Visibility Before -> After State Diff Banner right below Stepper */}
        <StateMutationDiffBanner
          diffs={mutationDiffs}
          onInspectLedger={() => {
            setTab2ViewMode('LEDGER');
            setActiveTab(1);
          }}
        />

        {/* 4 Full-Width Desktop Tabs Navigation Bar */}
        <div className="bg-white border border-[#E5E0D8] rounded-xl p-1.5 shadow-subtle flex flex-wrap gap-1.5">
          {tabs.map((tab) => {
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[200px] flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  isTabActive
                    ? 'bg-[#0070BA] text-white shadow-subtle'
                    : 'bg-transparent text-[#57534E] hover:text-[#1C1917] hover:bg-[#F9F8F5]'
                }`}
              >
                <div className="flex items-center space-x-2 text-left">
                  <tab.icon className={`w-4 h-4 flex-shrink-0 ${isTabActive ? 'text-white' : 'text-[#0070BA]'}`} />
                  <span className="tracking-tight">{tab.name}</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md flex-shrink-0 ml-2 ${
                    isTabActive ? 'bg-white/20 text-white' : tab.badgeColor
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Loading fallback state on very first paint */}
        {loading && milestones.length === 0 && ecosystemEvents.length === 0 && (
          <div className="bg-white border border-[#E5E0D8] rounded-xl p-8 text-center text-xs text-[#78716C] shadow-subtle">
            Synchronizing PayPal Aegis Tripartite Ecosystem state...
          </div>
        )}

        {/* TAB 1 (Index 0): Tripartite Ecosystem Canvas */}
        {activeTab === 0 && (
          <div className="animate-fadeIn">
            <SplitEcosystemCanvas
              milestones={milestones}
              disputes={disputes}
              pendingApprovals={pendingApprovals}
              ratioSnapshot={ratioSnapshot}
              events={ecosystemEvents}
              diffs={mutationDiffs}
              activeAgent={activeAgent}
              isExecuting={!!executingStep || !!busyAction}
              liveAgentInfo={liveAgentInfo}
              busyAction={busyAction}
              onClientApproveDeliverable={handleClientApproveDeliverable}
              onClientRaiseDispute={handleClientRaiseDispute}
              onClientAcceptOffer={handleClientAcceptOffer}
              onMerchantFastForwardDay3={handleMerchantFastForwardDay3}
              onMerchantVerifyDeliverable={handleMerchantVerifyDeliverable}
              onApproveHitl={handleApproveHitl}
              onRejectHitl={handleRejectHitl}
              onMerchantDispatchOffer={handleMerchantDispatchOffer}
              onMerchantSubmitEvidence={handleMerchantSubmitEvidence}
              onOpenDeepDiveTab={(tabIdx) => setActiveTab(tabIdx)}
            />
          </div>
        )}

        {/* TAB 2 (Index 1): State Mutation Diff, AG Studio 3 Ledger & Gantt */}
        {activeTab === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <StateMutationDiffBanner diffs={mutationDiffs} showHistoryList />

            {/* View Toggle preventing excess vertical scrolling */}
            <div className="bg-white border border-[#E5E0D8] rounded-xl p-2 flex flex-wrap items-center justify-between gap-2 shadow-subtle">
              <div className="px-2 text-xs font-bold text-[#1C1917] flex items-center gap-2">
                <span>Ledger & Timeline Workbench</span>
                <span className="text-[10px] font-mono text-[#78716C] font-normal">
                  Switch views or compare compactly without 2,200px vertical scroll
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {[
                  { key: 'LEDGER' as const, label: '📋 AG Studio 3 Ledger' },
                  { key: 'GANTT' as const, label: '📊 Bryntum Milestone Gantt' },
                  { key: 'SPLIT' as const, label: '◫ Compact Split' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setTab2ViewMode(opt.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      tab2ViewMode === opt.key
                        ? 'bg-[#1C1917] text-white shadow-subtle'
                        : 'bg-[#F9F8F5] text-[#57534E] border border-[#E5E0D8] hover:bg-[#F4F1EA]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {tab2ViewMode === 'LEDGER' && (
              <MutatedAuthLedger
                milestones={milestones}
                onFastForwardDay3={handleMerchantFastForwardDay3}
                onCapture={handleCapture}
              />
            )}

            {tab2ViewMode === 'GANTT' && (
              <BryntumGanttView milestones={milestones} disputes={disputes} />
            )}

            {tab2ViewMode === 'SPLIT' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <MutatedAuthLedger
                  milestones={milestones}
                  onFastForwardDay3={handleMerchantFastForwardDay3}
                  onCapture={handleCapture}
                />
                <BryntumGanttView milestones={milestones} disputes={disputes} />
              </div>
            )}
          </div>
        )}

        {/* TAB 3 (Index 2): Deliverable SafeGate & Multimodal Audit */}
        {activeTab === 2 && (
          <div className="animate-fadeIn">
            <DeliverableAuditSafeGateView
              milestones={milestones}
              pendingApprovals={pendingApprovals}
              onActionComplete={loadDashboardData}
            />
          </div>
        )}

        {/* TAB 4 (Index 3): 1.5% Dispute Shield & Evidentiary RAG */}
        {activeTab === 3 && (
          <div className="animate-fadeIn">
            <DisputeDefenseRevenueShieldView
              ratioSnapshot={ratioSnapshot}
              disputes={disputes}
              onActionComplete={loadDashboardData}
            />
          </div>
        )}

        {/* Persistent Actor-Attributed Cross-Party Notification & Activity Bus */}
        <CrossPartyNotificationCenter events={ecosystemEvents} />
      </main>

      {/* Collapsible Live Telemetry Inspector Drawer (Docked Bottom, Zero Content Collision) */}
      <LiveTelemetryInspectorDrawer
        currentStage={currentStage}
        telemetryData={liveWireData}
      />
    </div>
  );
}
