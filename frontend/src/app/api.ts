/**
 * OASIS 前端后端 API 客户端
 *
 * 为后端 API 服务提供类型化接口
 */

// 在开发环境使用空字符串（通过 Vite 代理），生产环境使用完整 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

// ============= 类型定义 =============

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

export type SystemLog = {
  id: string;
  timestamp: number;
  level: 'info' | 'ok' | 'error' | 'warn';
  message: string;
  category: string;
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

// ============= API 客户端 =============

class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`API 错误 ${status}: ${detail}`);
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
    const error = await response.json().catch(() => ({ error: '未知错误' }));
    throw new ApiError(response.status, error.error || error.detail || '请求失败');
  }

  return response.json();
}

// ============= 智能体 API =============

export const agentsApi = {
  /**
   * 获取所有智能体或按 ID 过滤
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
   * 根据 ID 获取单个智能体
   */
  async getById(id: number): Promise<AgentProfile> {
    return request<AgentProfile>(`/api/agents/${id}`);
  },

  /**
   * 根据多个 ID 获取智能体
   */
  async getByIds(ids: number[]): Promise<AgentProfile[]> {
    if (ids.length === 0) return [];
    return this.getAll({ ids });
  },

  /**
   * 获取智能体状态
   */
  async getState(id: number): Promise<AgentState> {
    return request<AgentState>(`/api/agents/${id}/state`);
  },

  /**
   * 更新智能体状态
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

// ============= 信息流 API =============

export const feedApi = {
  /**
   * 获取信息流帖子
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
   * 创建新帖子
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

// ============= 状态 API =============

export const stateApi = {
  /**
   * 获取模拟状态
   */
  async get(): Promise<SimulationState> {
    return request<SimulationState>('/api/state');
  },

  /**
   * 更新模拟状态
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

// ============= 模拟控制 API =============

export const simulationApi = {
  /**
   * 开始模拟
   */
  async start(speed?: number): Promise<void> {
    await request('/api/simulation/start', {
      method: 'POST',
      ...(speed !== undefined && { body: JSON.stringify({ speed }) }),
    });
  },

  /**
   * 停止模拟
   */
  async stop(): Promise<void> {
    await request('/api/simulation/stop', { method: 'POST' });
  },

  /**
   * 暂停模拟
   */
  async pause(): Promise<void> {
    await request('/api/simulation/pause', { method: 'POST' });
  },

  /**
   * 继续模拟
   */
  async resume(): Promise<void> {
    await request('/api/simulation/resume', { method: 'POST' });
  },

  /**
   * 设置模拟速度
   */
  async setSpeed(speed: number): Promise<void> {
    await request('/api/simulation/speed', {
      method: 'PUT',
      body: JSON.stringify({ speed }),
    });
  },

  /**
   * 设置当前时间步
   */
  async setTick(tick: number): Promise<void> {
    await request('/api/simulation/tick', {
      method: 'POST',
      body: JSON.stringify({ tick }),
    });
  },

  /**
   * 获取运行时模拟指标（弹性/可观测性）
   */
  async getMetrics(): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>('/api/simulation/metrics');
  },
};

// ============= 事件 API =============

export const eventsApi = {
  /**
   * 获取时间线事件
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
   * 创建时间线事件
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

// ============= 日志 API =============

export const logsApi = {
  /**
   * 获取模拟日志
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
   * 创建日志条目
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

// ============= 系统日志 API =============

export const systemLogsApi = {
  /**
   * 获取系统日志（后端调试日志）
   */
  async getAll(options?: {
    limit?: number;
    level?: 'info' | 'ok' | 'error' | 'warn';
  }): Promise<SystemLog[]> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.level) {
      params.append('level', options.level);
    }

    const query = params.toString();
    return request<SystemLog[]>(`/api/system-logs${query ? `?${query}` : ''}`);
  },
};

// ============= 快照 API =============

export const snapshotsApi = {
  /**
   * 获取所有快照
   */
  async getAll(): Promise<SimulationSnapshot[]> {
    return request<SimulationSnapshot[]>('/api/snapshots');
  },

  /**
   * 创建快照
   */
  async create(name: string): Promise<SimulationSnapshot> {
    return request<SimulationSnapshot>('/api/snapshots', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  /**
   * 根据 ID 获取快照
   */
  async getById(id: string): Promise<SimulationSnapshot & { data: SimulationState }> {
    return request<{ id: string; name: string; experimentName: string; createdAt: number; runNumber: number; finalTick: number; data: SimulationState }>(
      `/api/snapshots/${id}`,
    );
  },

  /**
   * 加载快照
   */
  async load(id: string): Promise<void> {
    await request(`/api/snapshots/${id}/load`, { method: 'POST' });
  },

  /**
   * 删除快照
   */
  async delete(id: string): Promise<void> {
    await request(`/api/snapshots/${id}`, { method: 'DELETE' });
  },
};

// ============= 书签 API =============

export const bookmarksApi = {
  /**
   * 获取所有书签
   */
  async getAll(): Promise<Bookmark[]> {
    return request<Bookmark[]>('/api/bookmarks');
  },

  /**
   * 创建书签
   */
  async create(data: { tick: number; note?: string }): Promise<Bookmark> {
    return request<Bookmark>('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 删除书签
   */
  async delete(id: string): Promise<void> {
    await request(`/api/bookmarks/${id}`, { method: 'DELETE' });
  },
};

// ============= 干预 API =============

export const interventionsApi = {
  /**
   * 获取干预历史
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
   * 创建干预
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

// ============= 可视化 API =============

export const visualizationApi = {
  /**
   * 获取智能体的 2D 布局位置
   */
  async getLayout(algorithm: 'force_directed' | 'circular' | 'grid' = 'force_directed'): Promise<{
    positions: Record<number, { x: number; y: number }>;
    algorithm: string;
  }> {
    return request(`/api/visualization/layout?algorithm=${algorithm}`);
  },

  /**
   * 从后端运行时数据库获取实际网络边
   */
  async getNetwork(options?: { limit?: number }): Promise<{
    edges: Array<{ source: number; target: number; kind: 'follow' | 'group' | 'message'; strength: number }>;
    source: string;
    error?: string;
  }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    const query = params.toString();
    return request(`/api/visualization/network${query ? `?${query}` : ''}`);
  },
};

// ============= 组合 API 导出 =============

export const api = {
  agents: agentsApi,
  feed: feedApi,
  state: stateApi,
  simulation: simulationApi,
  events: eventsApi,
  logs: logsApi,
  systemLogs: systemLogsApi,
  snapshots: snapshotsApi,
  bookmarks: bookmarksApi,
  interventions: interventionsApi,
  visualization: visualizationApi,
};

// ============= WebSocket 客户端 =============

export type WebSocketMessage =
  | { type: 'connected'; clientId: string; timestamp: string }
  | { type: 'tick_update'; tick: number; isRunning: boolean; speed: number; timestamp: string }
  | { type: 'agent_update'; agentId: number; state: AgentState; timestamp: string }
  | { type: 'post_created'; post: FeedPost; timestamp: string }
  | { type: 'event_created'; event: TimelineEvent; timestamp: string }
  | { type: 'log_added'; log: LogLine; timestamp: string }
  | { type: 'system_log'; log: SystemLog; timestamp: string }
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
      console.log('[WebSocket] 已连接');
      this.reconnectDelay = 1000;

      // 发送排队的消息
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

        // 通知所有监听器
        this.listeners.forEach((listener) => {
          try {
            listener(message);
          } catch (error) {
            console.error('[WebSocket] 监听器错误:', error);
          }
        });
      } catch (error) {
        console.error('[WebSocket] 解析消息失败:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('[WebSocket] 已断开');
      this.ws = null;

      if (!this.isIntentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] 错误:', error);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      console.log(`[WebSocket] ${this.reconnectDelay}ms 后重连...`);
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
      // 将消息排队等待连接建立
      this.messageQueue.push(message as WebSocketMessage);
      // 如果未连接则触发连接
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

// 全局 WebSocket 客户端实例
export const wsClient = new WebSocketClient();

export default api;
