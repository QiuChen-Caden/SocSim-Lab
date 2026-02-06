/**
 * API Client for OASIS Frontend Backend
 *
 * Provides a typed interface to the backend API service.
 */

// 在开发环境使用空字符串（通过 Vite 代理），生产环境使用完整 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

// ============= Types =============

export type ViewportMode = 'micro' | 'macro';
export type LogLevel = 'info' | 'ok' | 'error';
export type EventType = 'agent_action' | 'message' | 'intervention' | 'alert' | 'bookmark';

export type AgentProfile = {
  id: number;
  name: string;
  group: string;
  identity: Identity;
  psychometrics: Psychometrics;
  social_status: SocialStatus;
  behavior_profile: BehaviorProfile;
  cognitive_state: CognitiveState;
};

export type Identity = {
  username: string;
  age_band: string;
  gender: string;
  location: { country: string; region_city: string };
  profession: string;
  domain_of_expertise: string[];
};

export type Psychometrics = {
  personality: { big_five: BigFive };
  values: { moral_foundations: MoralFoundations };
};

export type BigFive = { O: number; C: number; E: number; A: number; N: number };
export type MoralFoundations = { care: number; fairness: number; loyalty: number; authority: number; sanctity: number };

export type SocialStatus = {
  influence_tier: string;
  economic_band: string;
  social_capital: { network_size_proxy: number };
};

export type BehaviorProfile = {
  posting_cadence: { posts_per_day: number; diurnal_pattern: string[] };
  rhetoric_style: { civility: number; evidence_citation: number };
};

export type CognitiveState = {
  core_affect: { sentiment: string; arousal: number };
  issue_stances: { topic: string; support: number; certainty: number }[];
};

export type AgentState = {
  mood: number;
  stance: number;
  resources: number;
  lastAction: string;
  evidence?: {
    memoryHits: Array<{ id: string; text: string; score: number }>;
    reasoningSummary: string;
    toolCalls: Array<{ id: string; name: string; status: 'ok' | 'error'; latencyMs: number }>;
  };
};

export type FeedPost = {
  id: string;
  tick: number;
  authorId: number;
  authorName: string;
  emotion: number;
  content: string;
  likes: number;
};

export type TimelineEvent = {
  id: string;
  tick: number;
  type: EventType;
  agentId?: number;
  title: string;
  payload?: Record<string, unknown>;
};

export type LogLine = {
  id: string;
  tick: number;
  agentId?: number;
  level: LogLevel;
  text: string;
};

export type SimulationConfig = {
  seed: number;
  agentCount: number;
  worldSize: number;
  ticksPerSecond: number;
  sampleAgents: number;
  viewportMode: ViewportMode;
  scenarioText: string;
  experimentName: string;
  designReady: boolean;
  llmEnabled: boolean;
  llmProvider: string;
  llmModel: string;
  llmBaseUrl: string;
  llmApiKey: string;
  llmTemperature: number;
  llmMaxTokens: number;
  llmTopP: number;
  llmActiveAgents: number;
  llmTimeoutMs: number;
  llmMaxRetries: number;
  llmRetryBackoffMs: number;
  llmMaxActionsPerMinute: number;
  llmFallbackOnError: boolean;
};

export type SimulationState = {
  config: SimulationConfig;
  tick: number;
  isRunning: boolean;
  speed: number;
  selectedAgentId: number | null;
  agents: Record<number, { profile: AgentProfile; state: AgentState }>;
  groups: Record<string, unknown>;
  logs: LogLine[];
  events: TimelineEvent[];
  feed: FeedPost[];
  interventions: unknown[];
  snapshots: unknown[];
  currentSnapshotId: string | null;
};

export type SimulationSnapshot = {
  id: string;
  name: string;
  experimentName: string;
  createdAt: number;
  runNumber: number;
  finalTick: number;
};

export type Bookmark = {
  id: string;
  tick: number;
  note: string;
  createdAt: number;
};

// ============= API Client =============

class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`API Error ${status}: ${detail}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const token = localStorage.getItem('auth_token');

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || error.detail || 'Request failed');
  }

  return response.json();
}

// ============= Agents API =============

export const agentsApi = {
  /**
   * Get all agents or filter by IDs
   */
  async getAll(options?: {
    ids?: number[];
    limit?: number;
    offset?: number;
  }): Promise<AgentProfile[]> {
    const params = new URLSearchParams();
    if (options?.ids) {
      params.append('ids', options.ids.join(','));
    }
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.offset) {
      params.append('offset', options.offset.toString());
    }

    const query = params.toString();
    return request<AgentProfile[]>(`/api/agents${query ? `?${query}` : ''}`);
  },

  /**
   * Get a single agent by ID
   */
  async getById(id: number): Promise<AgentProfile> {
    return request<AgentProfile>(`/api/agents/${id}`);
  },

  /**
   * Get multiple agents by IDs
   */
  async getByIds(ids: number[]): Promise<AgentProfile[]> {
    if (ids.length === 0) return [];
    return this.getAll({ ids });
  },

  /**
   * Get agent state
   */
  async getState(id: number): Promise<AgentState> {
    return request<AgentState>(`/api/agents/${id}/state`);
  },

  /**
   * Update agent state
   */
  async patchState(
    id: number,
    updates: Partial<Pick<AgentState, 'mood' | 'stance' | 'resources' | 'lastAction'>>,
  ): Promise<void> {
    await request(`/api/agents/${id}/state`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
};

// ============= Feed API =============

export const feedApi = {
  /**
   * Get feed posts
   */
  async getAll(options?: {
    limit?: number;
    offset?: number;
    sort?: 'time' | 'emotion' | 'likes';
  }): Promise<FeedPost[]> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.offset) {
      params.append('offset', options.offset.toString());
    }
    if (options?.sort) {
      params.append('sort', options.sort);
    }

    const query = params.toString();
    return request<FeedPost[]>(`/api/feed${query ? `?${query}` : ''}`);
  },

  /**
   * Create a new post
   */
  async create(data: {
    agentId: number;
    content: string;
    emotion?: number;
  }): Promise<FeedPost> {
    return request<FeedPost>('/api/feed', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============= State API =============

export const stateApi = {
  /**
   * Get simulation state
   */
  async get(): Promise<SimulationState> {
    return request<SimulationState>('/api/state');
  },

  /**
   * Update simulation state
   */
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

// ============= Simulation Control API =============

export const simulationApi = {
  /**
   * Start simulation
   */
  async start(speed?: number): Promise<void> {
    await request('/api/simulation/start', {
      method: 'POST',
      ...(speed !== undefined && { body: JSON.stringify({ speed }) }),
    });
  },

  /**
   * Stop simulation
   */
  async stop(): Promise<void> {
    await request('/api/simulation/stop', { method: 'POST' });
  },

  /**
   * Pause simulation
   */
  async pause(): Promise<void> {
    await request('/api/simulation/pause', { method: 'POST' });
  },

  /**
   * Resume simulation
   */
  async resume(): Promise<void> {
    await request('/api/simulation/resume', { method: 'POST' });
  },

  /**
   * Set simulation speed
   */
  async setSpeed(speed: number): Promise<void> {
    await request('/api/simulation/speed', {
      method: 'PUT',
      body: JSON.stringify({ speed }),
    });
  },

  /**
   * Set current tick
   */
  async setTick(tick: number): Promise<void> {
    await request('/api/simulation/tick', {
      method: 'POST',
      body: JSON.stringify({ tick }),
    });
  },

  /**
   * Get runtime simulation metrics (resilience/observability).
   */
  async getMetrics(): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>('/api/simulation/metrics');
  },
};

// ============= Events API =============

export const eventsApi = {
  /**
   * Get timeline events
   */
  async getAll(options?: {
    limit?: number;
    offset?: number;
  }): Promise<TimelineEvent[]> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.offset) {
      params.append('offset', options.offset.toString());
    }

    const query = params.toString();
    return request<TimelineEvent[]>(`/api/events${query ? `?${query}` : ''}`);
  },

  /**
   * Create a timeline event
   */
  async create(data: {
    tick: number;
    type: EventType;
    title: string;
    agentId?: number;
    payload?: Record<string, unknown>;
  }): Promise<TimelineEvent> {
    return request<TimelineEvent>('/api/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============= Logs API =============

export const logsApi = {
  /**
   * Get simulation logs
   */
  async getAll(options?: {
    limit?: number;
    offset?: number;
    level?: LogLevel;
  }): Promise<LogLine[]> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.offset) {
      params.append('offset', options.offset.toString());
    }
    if (options?.level) {
      params.append('level', options.level);
    }

    const query = params.toString();
    return request<LogLine[]>(`/api/logs${query ? `?${query}` : ''}`);
  },

  /**
   * Create a log entry
   */
  async create(data: {
    tick: number;
    level: LogLevel;
    text: string;
    agentId?: number;
  }): Promise<LogLine> {
    return request<LogLine>('/api/logs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============= Snapshots API =============

export const snapshotsApi = {
  /**
   * Get all snapshots
   */
  async getAll(): Promise<SimulationSnapshot[]> {
    return request<SimulationSnapshot[]>('/api/snapshots');
  },

  /**
   * Create a snapshot
   */
  async create(name: string): Promise<SimulationSnapshot> {
    return request<SimulationSnapshot>('/api/snapshots', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  /**
   * Get a snapshot by ID
   */
  async getById(id: string): Promise<SimulationSnapshot & { data: SimulationState }> {
    return request<{ id: string; name: string; experimentName: string; createdAt: number; runNumber: number; finalTick: number; data: SimulationState }>(
      `/api/snapshots/${id}`,
    );
  },

  /**
   * Load a snapshot
   */
  async load(id: string): Promise<void> {
    await request(`/api/snapshots/${id}/load`, { method: 'POST' });
  },

  /**
   * Delete a snapshot
   */
  async delete(id: string): Promise<void> {
    await request(`/api/snapshots/${id}`, { method: 'DELETE' });
  },
};

// ============= Bookmarks API =============

export const bookmarksApi = {
  /**
   * Get all bookmarks
   */
  async getAll(): Promise<Bookmark[]> {
    return request<Bookmark[]>('/api/bookmarks');
  },

  /**
   * Create a bookmark
   */
  async create(data: { tick: number; note?: string }): Promise<Bookmark> {
    return request<Bookmark>('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a bookmark
   */
  async delete(id: string): Promise<void> {
    await request(`/api/bookmarks/${id}`, { method: 'DELETE' });
  },
};

// ============= Interventions API =============

export const interventionsApi = {
  /**
   * Get intervention history
   */
  async getAll(options?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ id: string; tick: number; command: string; targetAgentId?: number }>> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.offset) {
      params.append('offset', options.offset.toString());
    }

    const query = params.toString();
    return request(`/api/interventions${query ? `?${query}` : ''}`);
  },

  /**
   * Create an intervention
   */
  async create(data: {
    tick: number;
    command: string;
    targetAgentId?: number;
  }): Promise<{ id: string; tick: number; command: string; targetAgentId?: number }> {
    return request('/api/intervention', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============= Visualization API =============

export const visualizationApi = {
  /**
   * Get 2D layout positions for agents
   */
  async getLayout(algorithm: 'force_directed' | 'circular' | 'grid' = 'force_directed'): Promise<{
    positions: Record<number, { x: number; y: number }>;
    algorithm: string;
  }> {
    return request(`/api/visualization/layout?algorithm=${algorithm}`);
  },
};

// ============= Combined API export =============

export const api = {
  agents: agentsApi,
  feed: feedApi,
  state: stateApi,
  simulation: simulationApi,
  events: eventsApi,
  logs: logsApi,
  snapshots: snapshotsApi,
  bookmarks: bookmarksApi,
  interventions: interventionsApi,
  visualization: visualizationApi,
};

// ============= WebSocket Client =============

export type WebSocketMessage =
  | { type: 'connected'; clientId: string; timestamp: string }
  | { type: 'tick_update'; tick: number; isRunning: boolean; speed: number; timestamp: string }
  | { type: 'agent_update'; agentId: number; state: AgentState; timestamp: string }
  | { type: 'post_created'; post: FeedPost; timestamp: string }
  | { type: 'event_created'; event: TimelineEvent; timestamp: string }
  | { type: 'log_added'; log: LogLine; timestamp: string }
  | { type: 'simulation_state'; state: SimulationState; timestamp: string }
  | { type: 'error'; error: string; details?: Record<string, unknown>; timestamp: string }
  | { type: 'pong'; timestamp: string };

export type WebSocketEventListener = (message: WebSocketMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private clientId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private isIntentionalClose = false;
  private listeners: Set<WebSocketEventListener> = new Set();
  private messageQueue: WebSocketMessage[] = [];

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected');
      this.reconnectDelay = 1000;

      // Send queued messages
      while (this.messageQueue.length > 0) {
        const msg = this.messageQueue.shift();
        if (msg) {
          this.send(msg as unknown as Record<string, unknown>);
        }
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;

        if (message.type === 'connected') {
          this.clientId = message.clientId;
        }

        // Notify all listeners
        this.listeners.forEach((listener) => {
          try {
            listener(message);
          } catch (error) {
            console.error('[WebSocket] Listener error:', error);
          }
        });
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      this.ws = null;

      if (!this.isIntentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      console.log(`[WebSocket] Reconnecting in ${this.reconnectDelay}ms...`);
      this.connect();
    }, this.reconnectDelay);
  }

  disconnect() {
    this.isIntentionalClose = true;
    if (this.ws) {
      this.ws.close();
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  send(message: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is established
      this.messageQueue.push(message as WebSocketMessage);
      // Trigger connection if not connecting
      if (!this.ws) {
        this.connect();
      }
    }
  }

  subscribe(options: {
    eventTypes?: string[];
    agentIds?: number[];
  }) {
    this.send({
      type: 'subscribe',
      eventTypes: options.eventTypes,
      agentIds: options.agentIds,
    });
  }

  unsubscribe(options: {
    eventTypes?: string[];
    agentIds?: number[];
  }) {
    this.send({
      type: 'unsubscribe',
      eventTypes: options.eventTypes,
      agentIds: options.agentIds,
    });
  }

  onMessage(listener: WebSocketEventListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  ping() {
    this.send({ type: 'ping' });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getClientId(): string | null {
    return this.clientId;
  }
}

// Global WebSocket client instance
export const wsClient = new WebSocketClient();

export default api;
