/**
 * Tripartite Ecosystem Event & State Mutation Bus
 *
 * Centralizes real-time cross-actor event logging (Client <-> PayPal <-> Business)
 * and structured Before -> After State Mutation Diff tracking.
 */

import { v4 as uuidv4 } from 'uuid';
import { store } from './store';
import logger from './logger';
import type {
  EcosystemActor,
  EcosystemEvent,
  EcosystemEventType,
  StateMutationChange,
  StateMutationDiff,
} from '../types';

type BusSocketEmitter = (event: string, data: unknown) => void;
let socketEmitter: BusSocketEmitter | null = null;

export function registerEcosystemSocketEmitter(emitter: BusSocketEmitter): void {
  socketEmitter = emitter;
}

function broadcast(eventName: string, payload: unknown): void {
  if (socketEmitter) {
    try {
      socketEmitter(eventName, payload);
    } catch (err: any) {
      logger.warn('Ecosystem bus socket broadcast failed', { eventName, error: err.message });
    }
  }
}

export function publishEcosystemEvent(params: {
  sender: EcosystemActor;
  recipient: EcosystemActor | 'ALL';
  agentName: string;
  eventType: EcosystemEventType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
}): EcosystemEvent {
  const event: EcosystemEvent = {
    id: `evt-${uuidv4().slice(0, 8)}`,
    timestamp: new Date().toISOString(),
    ...params,
  };

  store.addEcosystemEvent(event);
  broadcast('ecosystem:event', event);
  broadcast('schedule:sync', { type: params.eventType, eventId: event.id });
  return event;
}

export function publishStateMutationDiff(params: {
  actionLabel: string;
  actor: EcosystemActor;
  agentName: string;
  targetId: string;
  changes: StateMutationChange[];
  downstreamImpact: string;
}): StateMutationDiff {
  const diff: StateMutationDiff = {
    id: `diff-${uuidv4().slice(0, 8)}`,
    timestamp: new Date().toISOString(),
    ...params,
  };

  store.addMutationDiff(diff);
  broadcast('ecosystem:diff', diff);
  return diff;
}

export function emitAgentState(agentName: string, phase: string, status: 'THINKING' | 'COMPLETED'): void {
  broadcast('agent:status', {
    agentName,
    phase,
    status,
    timestamp: new Date().toISOString(),
  });
}

