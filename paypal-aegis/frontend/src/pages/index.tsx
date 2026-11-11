import React, { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { io, Socket } from 'socket.io-client';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { Sidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';
import { MutationToast } from '../components/notifications/MutationToast';
import { OverviewPage } from '../components/pages/OverviewPage';
import { EscrowContractPage } from '../components/pages/EscrowContractPage';
import { DeliverablesApprovalsPage } from '../components/pages/DeliverablesApprovalsPage';
import { DisputesPage } from '../components/pages/DisputesPage';
import { ActivityPage } from '../components/pages/ActivityPage';
import { DevToolsDrawer } from '../components/drawers/DevToolsDrawer';
import { DemoControlsDrawer } from '../components/drawers/DemoControlsDrawer';
import type {
  AgentKey,
  CustomSandboxExecutionPayload,
  DisputeRatioSnapshot,
  EcosystemEvent,
  HITLApprovalRequest,
  Milestone,
  NavPage,
  PayPalDispute,
  Project,
  StateMutationDiff,
  StepExecutionInfo,
  StepId,
  UserRole,
  WireTelemetryData,
} from '../types';

const INITIAL_STEP_STATUS: Record<StepId, StepExecutionInfo> = {
  1: { status: 'IDLE' },
  2: { status: 'IDLE' },
  3: { status: 'IDLE' },
  4: { status: 'IDLE' },
};

function computeCrc32Hex(input: string): string {
  let crc = 0xffffffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i);
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return '0x' + ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export default function PayPalAegisApp() {
  // Navigation & role state
  const [activePage, setActivePage] = useState<NavPage>('overview');
  const [role, setRole] = useState<UserRole>('CLIENT');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Slide-over drawers
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [devToolsTab, setDevToolsTab] = useState<'wire' | 'trace' | 'diff'>('wire');
  const [demoOpen, setDemoOpen] = useState(false);

  // Domain state
  const [demoMode, setDemoMode] = useState<string>('DETERMINISTIC_SIMULATION');
  const [project, setProject] = useState<Project | undefined>(undefined);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [disputes, setDisputes] = useState<PayPalDispute[]>([]);
  const [ratioSnapshot, setRatioSnapshot] = useState<DisputeRatioSnapshot | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<HITLApprovalRequest[]>([]);
  const [events, setEvents] = useState<EcosystemEvent[]>([]);
  const [diffs, setDiffs] = useState<StateMutationDiff[]>([]);

  // Telemetry & notification state
  const [socketConnected, setSocketConnected] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastDiff, setToastDiff] = useState<StateMutationDiff | null>(null);

  // Demo stepper & AI telemetry state
  const [currentStage, setCurrentStage] = useState<StepId>(1);
  const [executingStep, setExecutingStep] = useState<StepId | null>(null);
  const [stepStatusMap, setStepStatusMap] =
    useState<Record<StepId, StepExecutionInfo>>(INITIAL_STEP_STATUS);
  const [activeAgent, setActiveAgent] = useState<AgentKey>(null);
  const [liveAgentInfo, setLiveAgentInfo] = useState<{
    agentName: string;
    phase: string;
    status: string;
  } | null>(null);
  const [telemetryData, setTelemetryData] = useState<Partial<WireTelemetryData> | undefined>(
    undefined
  );

  const socketRef = useRef<Socket | null>(null);
  const seenDiffIdsRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMutationToast = useCallback((diff: StateMutationDiff) => {
    if (!diff?.id) return;
    if (seenDiffIdsRef.current.has(diff.id)) return;
    seenDiffIdsRef.current.add(diff.id);
    setToastDiff(diff);

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastDiff(null);
    }, 7500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const syncTelemetry = useCallback(
    async (
      method: string,
      endpoint: string,
      latencyMs: number,
      rawResponse: Record<string, any>,
      stage: StepId
    ) => {
      setCurrentStage(stage);
      const serialized = JSON.stringify(rawResponse || {});
      const baseTelemetry: Partial<WireTelemetryData> = {
        method,
        endpoint,
        latencyMs: Math.round(latencyMs),
        statusCode: 200,
        requestId:
          (rawResponse?.paypalRequestId as string) ||
          `aegis-${Date.now().toString(36)}`,
        crc32Checksum: computeCrc32Hex(serialized),
        rawResponse,
      };

      try {
        const [ragRes, agentRes] = await Promise.allSettled([
          api.getRagTelemetry(),
          api.getAgentTelemetry(),
        ]);

        if (ragRes.status === 'fulfilled' && ragRes.value) {
          baseTelemetry.liveRag = ragRes.value as WireTelemetryData['liveRag'];
        }
        if (agentRes.status === 'fulfilled' && agentRes.value) {
          baseTelemetry.liveAgent = agentRes.value as WireTelemetryData['liveAgent'];
        }
      } catch {
        // Telemetry polling is best-effort for Dev tools drawer
      }

      setTelemetryData(baseTelemetry);
    },
    []
  );

  const fetchAllData = useCallback(async () => {
    try {
      const [
        statusRes,
        projectsRes,
        milestonesRes,
        disputesRes,
        ratioRes,
        approvalsRes,
        feedRes,
        ragRes,
        agentRes,
      ] = await Promise.all([
        api.getDemoStatus(),
        api.getProjects(),
        api.getMilestones(),
        api.getDisputes(),
        api.getDisputeRatio(),
        api.getPendingApprovals(),
        api.getEcosystemFeed(),
        api.getRagTelemetry().catch(() => null),
        api.getAgentTelemetry().catch(() => null),
      ]);

      if (statusRes?.mode) {
        setDemoMode(statusRes.mode);
      }
      setProject(Array.isArray(projectsRes) ? projectsRes[0] : undefined);
      setMilestones(Array.isArray(milestonesRes) ? milestonesRes : []);
      setDisputes(Array.isArray(disputesRes) ? disputesRes : []);
      setRatioSnapshot(ratioRes?.current || null);
      setPendingApprovals(Array.isArray(approvalsRes) ? approvalsRes : []);

      if (ragRes || agentRes) {
        setTelemetryData((prev) => ({
          ...prev,
          ...(ragRes ? { liveRag: ragRes as WireTelemetryData['liveRag'] } : {}),
          ...(agentRes ? { liveAgent: agentRes as WireTelemetryData['liveAgent'] } : {}),
        }));
      }

      if (feedRes) {
        if (Array.isArray(feedRes.events)) {
          setEvents(feedRes.events);
        }
        if (Array.isArray(feedRes.diffs)) {
          setDiffs(feedRes.diffs);
          feedRes.diffs.forEach((d: StateMutationDiff) => {
            if (!seenDiffIdsRef.current.has(d.id)) {
              seenDiffIdsRef.current.add(d.id);
            }
          });
        }
      }
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.error || err?.message || 'Unable to sync with PayPal Aegis backend.'
      );
    }
  }, []);

  // Initial load + Socket.IO real-time synchronization
  useEffect(() => {
    fetchAllData();

    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      (typeof window !== 'undefined' && window.location.port === '3000'
        ? 'http://localhost:3001'
        : typeof window !== 'undefined'
          ? window.location.origin
          : 'http://localhost:3001');

    const socket = io(wsUrl, {
      transports: ['polling', 'websocket'],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('ecosystem:event', (newEvent: EcosystemEvent) => {
      setEvents((prev) => {
        if (prev.some((e) => e.id === newEvent.id)) return prev;
        return [newEvent, ...prev];
      });
    });

    socket.on('ecosystem:diff', (newDiff: StateMutationDiff) => {
      setDiffs((prev) => {
        if (prev.some((d) => d.id === newDiff.id)) return prev;
        return [newDiff, ...prev];
      });
      showMutationToast(newDiff);
    });

    socket.on(
      'agent:status',
      (payload: { agentName?: string; phase?: string; status?: string }) => {
        setLiveAgentInfo({
          agentName: payload?.agentName || 'PayPalAegis',
          phase: payload?.phase || 'Executing',
          status: payload?.status || 'IN_PROGRESS',
        });
        if (payload?.agentName?.includes('Contract')) setActiveAgent('ContractParser');
        else if (payload?.agentName?.includes('Delivery')) setActiveAgent('DeliveryAuditor');
        else if (payload?.agentName?.includes('Dispute')) setActiveAgent('DisputeStrategist');
      }
    );

    const syncEvents = [
      'hitl:pending',
      'hitl:approved',
      'hitl:rejected',
      'hitl:action_intercepted',
      'hitl:action_resolved',
      'schedule:sync',
    ];
    syncEvents.forEach((evt) => {
      socket.on(evt, () => {
        fetchAllData();
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [fetchAllData, showMutationToast]);

  const runAction = useCallback(
    async <T,>(
      actionKey: string,
      fn: () => Promise<T>,
      telemetryMeta?: { method: string; endpoint: string; stage: StepId; agent?: AgentKey }
    ): Promise<T | undefined> => {
      setErrorMessage(null);
      setBusyAction(actionKey);
      if (telemetryMeta?.agent) {
        setActiveAgent(telemetryMeta.agent);
      }

      const start = performance.now();
      try {
        const res = await fn();
        const elapsed = performance.now() - start;

        await fetchAllData();

        if (telemetryMeta) {
          await syncTelemetry(
            telemetryMeta.method,
            telemetryMeta.endpoint,
            elapsed,
            (res as Record<string, any>) || {},
            telemetryMeta.stage
          );
        }

        if ((res as any)?.diff) {
          showMutationToast((res as any).diff);
        }

        return res;
      } catch (err: any) {
        setErrorMessage(
          err?.response?.data?.error || err?.message || `Action failed: ${actionKey}`
        );
        return undefined;
      } finally {
        setBusyAction(null);
        setActiveAgent(null);
      }
    },
    [fetchAllData, showMutationToast, syncTelemetry]
  );

  // Action Handlers
  const handleSeedContract = useCallback(async () => {
    setExecutingStep(1);
    setStepStatusMap((prev) => ({ ...prev, 1: { status: 'IN_FLIGHT' } }));
    const start = performance.now();
    try {
      const res = await runAction(
        'seed',
        () => api.fixtureSeedContract(),
        {
          method: 'POST',
          endpoint: '/api/demo/fixtures/seed-contract',
          stage: 1,
          agent: 'ContractParser',
        }
      );
      if (res) {
        setStepStatusMap((prev) => ({
          ...prev,
          1: {
            status: 'SUCCESS',
            statusCode: 200,
            latencyMs: Math.round(performance.now() - start),
            lastExecutedAt: new Date().toISOString(),
            summary: 'Contract seeded & Milestone 1 authorized ($1,250.00)',
          },
        }));
      }
    } finally {
      setExecutingStep(null);
    }
  }, [runAction]);

  const handleLockMilestoneHold = useCallback(
    async (milestoneId: string) => {
      await runAction(
        `hold:${milestoneId}`,
        () => api.createMilestoneHold(milestoneId),
        {
          method: 'POST',
          endpoint: `/api/escrow/milestones/${milestoneId}/hold`,
          stage: 1,
          agent: 'ContractParser',
        }
      );
    },
    [runAction]
  );

  const handleFastForwardDay3 = useCallback(
    async (milestoneId: string, simulateNegative = false) => {
      setExecutingStep(2);
      setStepStatusMap((prev) => ({ ...prev, 2: { status: 'IN_FLIGHT' } }));
      const start = performance.now();
      try {
        const res = await runAction(
          'fast-forward',
          () => api.fixtureFastForwardDay3(milestoneId, simulateNegative),
          {
            method: 'POST',
            endpoint: '/api/demo/fixtures/fast-forward-day3',
            stage: 2,
            agent: 'ContractParser',
          }
        );
        if (res) {
          setStepStatusMap((prev) => ({
            ...prev,
            2: {
              status: 'SUCCESS',
              statusCode: 200,
              latencyMs: Math.round(performance.now() - start),
              lastExecutedAt: new Date().toISOString(),
              summary: 'Day-3 72h auth expiry simulated & SafeGate token rotated',
            },
          }));
        }
      } finally {
        setExecutingStep(null);
      }
    },
    [runAction]
  );

  const handleMerchantVerifyDeliverable = useCallback(
    async (
      milestoneId: string,
      options?: {
        customTitle?: string;
        customSku?: string;
        fileName?: string;
        fileSha256?: string;
      }
    ) => {
      setExecutingStep(3);
      setStepStatusMap((prev) => ({ ...prev, 3: { status: 'IN_FLIGHT' } }));
      const start = performance.now();
      try {
        const res = await runAction(
          'verify-deliverable',
          () =>
            api.fixtureVerifyDeliverable(
              options ? { milestoneId, ...options } : milestoneId
            ),
          {
            method: 'POST',
            endpoint: '/api/demo/fixtures/verify-deliverable',
            stage: 3,
            agent: 'DeliveryAuditor',
          }
        );
        if (res) {
          setStepStatusMap((prev) => ({
            ...prev,
            3: {
              status: 'SUCCESS',
              statusCode: 200,
              latencyMs: Math.round(performance.now() - start),
              lastExecutedAt: new Date().toISOString(),
              summary: 'Deliverable SHA-256 & spec verified; SafeGate capture queued',
            },
          }));
        }
      } finally {
        setExecutingStep(null);
      }
    },
    [runAction]
  );

  const handleCaptureMilestone = useCallback(
    async (milestoneId: string) => {
      await runAction(
        `capture:${milestoneId}`,
        () => api.captureMilestone(milestoneId, true),
        {
          method: 'POST',
          endpoint: `/api/escrow/milestones/${milestoneId}/capture`,
          stage: 3,
          agent: 'DeliveryAuditor',
        }
      );
    },
    [runAction]
  );

  const handleVoidMilestone = useCallback(
    async (milestoneId: string) => {
      await runAction(
        `void:${milestoneId}`,
        () => api.voidMilestone(milestoneId, 'Voided from Escrow & Contract view'),
        {
          method: 'POST',
          endpoint: `/api/escrow/milestones/${milestoneId}/void`,
          stage: 2,
          agent: 'ContractParser',
        }
      );
    },
    [runAction]
  );

  const handleApproveHitl = useCallback(
    async (approvalId: string) => {
      await runAction(
        `hitl:approve:${approvalId}`,
        () => api.approveHitlAction(approvalId, 'CLIENT_SIGNER'),
        {
          method: 'POST',
          endpoint: `/api/hitl/approvals/${approvalId}/approve`,
          stage: 3,
          agent: 'DeliveryAuditor',
        }
      );
    },
    [runAction]
  );

  const handleRejectHitl = useCallback(
    async (approvalId: string) => {
      await runAction(
        `hitl:reject:${approvalId}`,
        () =>
          api.rejectHitlAction(approvalId, 'CLIENT_SIGNER', 'Rejected via SafeGate review'),
        {
          method: 'POST',
          endpoint: `/api/hitl/approvals/${approvalId}/reject`,
          stage: 3,
          agent: 'DeliveryAuditor',
        }
      );
    },
    [runAction]
  );

  const handleClientApproveDeliverable = useCallback(
    async (milestoneId: string) => {
      await runAction(
        `client:approve:${milestoneId}`,
        () => api.clientApproveMilestone(milestoneId),
        {
          method: 'POST',
          endpoint: `/api/escrow/milestones/${milestoneId}/client-approve`,
          stage: 3,
          agent: 'DeliveryAuditor',
        }
      );
    },
    [runAction]
  );

  const handleClientRaiseDispute = useCallback(
    async (
      milestoneId: string,
      options?: { reason?: string; disputeAmount?: string; message?: string }
    ) => {
      setExecutingStep(4);
      setStepStatusMap((prev) => ({ ...prev, 4: { status: 'IN_FLIGHT' } }));
      const start = performance.now();
      try {
        const res = await runAction(
          `client:dispute:${milestoneId}`,
          () =>
            api.clientDisputeMilestone(milestoneId, {
              reason: options?.reason || 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
              ...(options?.disputeAmount ? { disputeAmount: options.disputeAmount } : {}),
              ...(options?.message ? { message: options.message } : {}),
            }),
          {
            method: 'POST',
            endpoint: `/api/escrow/milestones/${milestoneId}/client-dispute`,
            stage: 4,
            agent: 'DisputeStrategist',
          }
        );
        if (res) {
          setStepStatusMap((prev) => ({
            ...prev,
            4: {
              status: 'SUCCESS',
              statusCode: 200,
              latencyMs: Math.round(performance.now() - start),
              lastExecutedAt: new Date().toISOString(),
              summary: 'Dispute opened by Client & routed through Dispute Shield',
            },
          }));
        }
      } finally {
        setExecutingStep(null);
      }
    },
    [runAction]
  );

  const handleDispatchOffer = useCallback(
    async (disputeId: string, amount: string) => {
      await runAction(
        `dispute:offer:${disputeId}`,
        () =>
          api.makeDisputeOffer(
            disputeId,
            amount,
            'Automated settlement offer via PayPal Aegis Dispute Shield'
          ),
        {
          method: 'POST',
          endpoint: `/api/disputes/${disputeId}/make-offer`,
          stage: 4,
          agent: 'DisputeStrategist',
        }
      );
    },
    [runAction]
  );

  const handleClientAcceptOffer = useCallback(
    async (disputeId: string, amount: string) => {
      await runAction(
        `dispute:accept:${disputeId}`,
        () => api.acceptDisputeOffer(disputeId, amount),
        {
          method: 'POST',
          endpoint: `/api/disputes/${disputeId}/accept-offer`,
          stage: 4,
          agent: 'DisputeStrategist',
        }
      );
    },
    [runAction]
  );

  const handleSubmitEvidence = useCallback(
    async (disputeId: string) => {
      await runAction(
        `dispute:evidence:${disputeId}`,
        () => api.provideDisputeEvidence(disputeId),
        {
          method: 'POST',
          endpoint: `/api/disputes/${disputeId}/provide-evidence`,
          stage: 4,
          agent: 'DisputeStrategist',
        }
      );
    },
    [runAction]
  );

  // Demo Panel handlers
  const handleExecuteStep = useCallback(
    async (stepId: StepId, simulateNegative = false) => {
      const targetMilestone = milestones[0]?.id || 'm1-cloud-arch';
      if (stepId === 1) {
        await handleSeedContract();
        return;
      }
      if (stepId === 2) {
        await handleFastForwardDay3(targetMilestone, simulateNegative);
        return;
      }
      if (stepId === 3) {
        await handleMerchantVerifyDeliverable(targetMilestone);
        return;
      }
      if (stepId === 4) {
        setExecutingStep(4);
        setStepStatusMap((prev) => ({ ...prev, 4: { status: 'IN_FLIGHT' } }));
        const start = performance.now();
        try {
          const res = await runAction(
            'simulate-dispute',
            () => api.fixtureSimulateDispute(),
            {
              method: 'POST',
              endpoint: '/api/demo/fixtures/simulate-dispute',
              stage: 4,
              agent: 'DisputeStrategist',
            }
          );
          if (res) {
            setStepStatusMap((prev) => ({
              ...prev,
              4: {
                status: 'SUCCESS',
                statusCode: 200,
                latencyMs: Math.round(performance.now() - start),
                lastExecutedAt: new Date().toISOString(),
                summary: 'Dispute scenario simulated (ratio checked by DisputeStrategist)',
              },
            }));
          }
        } finally {
          setExecutingStep(null);
        }
      }
    },
    [
      milestones,
      handleSeedContract,
      handleFastForwardDay3,
      handleMerchantVerifyDeliverable,
      runAction,
    ]
  );

  const handleSimulateBranchB = useCallback(async () => {
    setExecutingStep(4);
    try {
      await runAction(
        'simulate-branch-b',
        () => api.simulateEscalatedChargeback('350.00'),
        {
          method: 'POST',
          endpoint: '/api/disputes/simulate-chargeback',
          stage: 4,
          agent: 'DisputeStrategist',
        }
      );
      setActivePage('disputes');
    } finally {
      setExecutingStep(null);
    }
  }, [runAction]);

  const handleExecuteCustomAction = useCallback(
    async (execution: CustomSandboxExecutionPayload) => {
      if (execution.actionType === 'SEED_CONTRACT') {
        setExecutingStep(1);
        setStepStatusMap((prev) => ({ ...prev, 1: { status: 'IN_FLIGHT' } }));
        const start = performance.now();
        try {
          const res = await runAction(
            'custom-seed',
            () => api.fixtureSeedContract(execution.payload),
            {
              method: 'POST',
              endpoint: '/api/demo/fixtures/seed-contract',
              stage: 1,
              agent: 'ContractParser',
            }
          );
          if (res) {
            setStepStatusMap((prev) => ({
              ...prev,
              1: {
                status: 'SUCCESS',
                statusCode: 200,
                latencyMs: Math.round(performance.now() - start),
                lastExecutedAt: new Date().toISOString(),
                summary: execution.summary,
              },
            }));
          }
        } finally {
          setExecutingStep(null);
        }
        return;
      }

      if (execution.actionType === 'VERIFY_DELIVERABLE') {
        setExecutingStep(3);
        setStepStatusMap((prev) => ({ ...prev, 3: { status: 'IN_FLIGHT' } }));
        const start = performance.now();
        try {
          const res = await runAction(
            'custom-verify',
            () => api.fixtureVerifyDeliverable(execution.payload),
            {
              method: 'POST',
              endpoint: '/api/demo/fixtures/verify-deliverable',
              stage: 3,
              agent: 'DeliveryAuditor',
            }
          );
          if (res) {
            setStepStatusMap((prev) => ({
              ...prev,
              3: {
                status: 'SUCCESS',
                statusCode: 200,
                latencyMs: Math.round(performance.now() - start),
                lastExecutedAt: new Date().toISOString(),
                summary: execution.summary,
              },
            }));
          }
        } finally {
          setExecutingStep(null);
        }
        return;
      }

      if (execution.actionType === 'SIMULATE_DISPUTE') {
        setExecutingStep(4);
        setStepStatusMap((prev) => ({ ...prev, 4: { status: 'IN_FLIGHT' } }));
        const start = performance.now();
        try {
          const res = await runAction(
            'custom-dispute',
            () => api.fixtureSimulateDispute(execution.payload),
            {
              method: 'POST',
              endpoint: '/api/demo/fixtures/simulate-dispute',
              stage: 4,
              agent: 'DisputeStrategist',
            }
          );
          if (res) {
            setStepStatusMap((prev) => ({
              ...prev,
              4: {
                status: 'SUCCESS',
                statusCode: 200,
                latencyMs: Math.round(performance.now() - start),
                lastExecutedAt: new Date().toISOString(),
                summary: execution.summary,
              },
            }));
          }
        } finally {
          setExecutingStep(null);
        }
      }
    },
    [runAction]
  );

  const handleResetWorkspace = useCallback(async () => {
    setErrorMessage(null);
    setBusyAction('reset');
    try {
      await api.resetDemo();
      setStepStatusMap(INITIAL_STEP_STATUS);
      setCurrentStage(1);
      setTelemetryData(undefined);
      setLiveAgentInfo(null);
      setToastDiff(null);
      seenDiffIdsRef.current.clear();
      await fetchAllData();
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.error || err?.message || 'Unable to reset workspace.'
      );
    } finally {
      setBusyAction(null);
    }
  }, [fetchAllData]);

  const hasOpenDispute = disputes.some((d) => d.status !== 'RESOLVED');

  return (
    <>
      <Head>
        <title>PayPal Aegis — Programmable Escrow &amp; Dispute Shield</title>
        <meta
          name="description"
          content="Milestone escrow, deliverable verification, and automated dispute resolution powered by PayPal Aegis."
        />
      </Head>

      <div className="min-h-screen flex bg-[#F9F8F5] text-[#1C1917]">
        {/* Left Navigation Sidebar */}
        <Sidebar
          activePage={activePage}
          onSelectPage={setActivePage}
          onOpenDevTools={() => {
            setDemoOpen(false);
            setDevToolsTab('wire');
            setDevToolsOpen(true);
          }}
          onOpenDemo={() => {
            setDevToolsOpen(false);
            setDemoOpen(true);
          }}
          isDevToolsOpen={devToolsOpen}
          isDemoOpen={demoOpen}
          pendingApprovalsCount={pendingApprovals.length}
          hasOpenDispute={hasOpenDispute}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />

        {/* Right Workspace Column */}
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            role={role}
            onChangeRole={setRole}
            pendingApprovals={pendingApprovals}
            onApproveHitl={handleApproveHitl}
            onRejectHitl={handleRejectHitl}
            onNavigateDelivery={() => setActivePage('delivery')}
            busyAction={busyAction}
            mode={demoMode}
            socketConnected={socketConnected}
            onOpenMobileMenu={() => setMobileNavOpen(true)}
          />

          <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {errorMessage && (
              <div
                role="alert"
                className="mb-5 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-rose-800"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ExclamationTriangleIcon className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span className="truncate font-medium">{errorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="p-1 rounded hover:bg-rose-100 text-rose-700"
                  aria-label="Dismiss error"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            )}

            {activePage === 'overview' && (
              <OverviewPage
                role={role}
                milestones={milestones}
                disputes={disputes}
                pendingApprovals={pendingApprovals}
                ratioSnapshot={ratioSnapshot}
                events={events}
                busyAction={busyAction}
                onNavigate={setActivePage}
                onSeedContract={handleSeedContract}
                onLockMilestoneHold={handleLockMilestoneHold}
                onFastForwardDay3={handleFastForwardDay3}
                onVerifyDeliverable={handleMerchantVerifyDeliverable}
                onApproveHitl={handleApproveHitl}
                onClientApproveDeliverable={handleClientApproveDeliverable}
                onDispatchOffer={handleDispatchOffer}
                onSubmitEvidence={handleSubmitEvidence}
                onClientAcceptOffer={handleClientAcceptOffer}
              />
            )}

            {activePage === 'escrow' && (
              <EscrowContractPage
                role={role}
                project={project}
                milestones={milestones}
                disputes={disputes}
                busyAction={busyAction}
                onSeedContract={handleSeedContract}
                onLockMilestoneHold={handleLockMilestoneHold}
                onFastForwardDay3={handleFastForwardDay3}
                onCapture={handleCaptureMilestone}
                onVoidMilestone={handleVoidMilestone}
              />
            )}

            {activePage === 'delivery' && (
              <DeliverablesApprovalsPage
                role={role}
                milestones={milestones}
                pendingApprovals={pendingApprovals}
                busyAction={busyAction}
                onClientApproveDeliverable={handleClientApproveDeliverable}
                onClientRaiseDispute={handleClientRaiseDispute}
                onMerchantVerifyDeliverable={handleMerchantVerifyDeliverable}
                onApproveHitl={handleApproveHitl}
                onRejectHitl={handleRejectHitl}
                onCaptureMilestone={handleCaptureMilestone}
              />
            )}

            {activePage === 'disputes' && (
              <DisputesPage
                role={role}
                ratioSnapshot={ratioSnapshot}
                disputes={disputes}
                milestones={milestones}
                busyAction={busyAction}
                onDispatchOffer={handleDispatchOffer}
                onSubmitEvidence={handleSubmitEvidence}
                onClientAcceptOffer={handleClientAcceptOffer}
                onClientRaiseDispute={handleClientRaiseDispute}
              />
            )}

            {activePage === 'activity' && <ActivityPage events={events} />}
          </main>
        </div>

        {/* Mutation Diff Toast */}
        <MutationToast
          diff={toastDiff}
          onDismiss={() => setToastDiff(null)}
          onInspectDevTools={() => {
            setToastDiff(null);
            setDemoOpen(false);
            setDevToolsTab('diff');
            setDevToolsOpen(true);
          }}
        />

        {/* Engineering / Judge Drawer */}
        <DevToolsDrawer
          isOpen={devToolsOpen}
          initialTab={devToolsTab}
          onClose={() => setDevToolsOpen(false)}
          currentStage={currentStage}
          telemetryData={telemetryData}
          diffs={diffs}
          activeAgent={activeAgent}
          isExecuting={executingStep !== null || busyAction !== null}
          liveAgentInfo={liveAgentInfo}
        />

        {/* Demo Controls Drawer */}
        <DemoControlsDrawer
          isOpen={demoOpen}
          onClose={() => setDemoOpen(false)}
          milestones={milestones}
          executingStep={executingStep}
          stepStatusMap={stepStatusMap}
          busyAction={busyAction}
          onExecuteStep={handleExecuteStep}
          onSimulateBranchB={handleSimulateBranchB}
          onExecuteCustomAction={handleExecuteCustomAction}
          onResetWorkspace={handleResetWorkspace}
          onRefreshData={fetchAllData}
        />
      </div>
    </>
  );
}
