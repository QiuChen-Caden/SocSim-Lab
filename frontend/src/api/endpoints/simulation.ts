import { request } from '../client';
import type { SimulationState, SimulationConfig } from '../../types';

export const simulationApi = {
  async start(speed?: number): Promise<void> {
    await request('/api/simulation/start', {
      method: 'POST',
      ...(speed !== undefined && { body: JSON.stringify({ speed }) }),
    });
  },

  async stop(): Promise<void> {
    await request('/api/simulation/stop', { method: 'POST' });
  },

  async pause(): Promise<void> {
    await request('/api/simulation/pause', { method: 'POST' });
  },

  async resume(): Promise<void> {
    await request('/api/simulation/resume', { method: 'POST' });
  },

  async setSpeed(speed: number): Promise<void> {
    await request('/api/simulation/speed', {
      method: 'PUT',
      body: JSON.stringify({ speed }),
    });
  },

  async setTick(tick: number): Promise<void> {
    await request('/api/simulation/tick', {
      method: 'POST',
      body: JSON.stringify({ tick }),
    });
  },

  async getMetrics(): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>('/api/simulation/metrics');
  },
};

export const stateApi = {
  async get(): Promise<SimulationState> {
    return request<SimulationState>('/api/state');
  },

  async patch(updates: {
    isRunning?: boolean;
    speed?: number;
    tick?: number;
    selectedAgentId?: number | null;
    config?: Partial<SimulationConfig>;
  }): Promise<void> {
    await request('/api/state', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
};
