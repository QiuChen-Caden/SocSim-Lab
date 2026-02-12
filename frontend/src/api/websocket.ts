import type { WebSocketEventListener, WebSocketMessage } from '../types';

function resolveWebSocketUrl(): string {
  const explicitWsUrl = import.meta.env.VITE_WS_URL?.trim();
  if (explicitWsUrl) {
    return explicitWsUrl;
  }

  const apiBaseUrl = import.meta.env.VITE_API_URL?.trim();
  if (apiBaseUrl) {
    try {
      const url = new URL(apiBaseUrl);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.pathname = '/ws';
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return `${apiBaseUrl.replace(/\/$/, '').replace(/^http/i, 'ws')}/ws`;
    }
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

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
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.isIntentionalClose = false;
    const wsUrl = resolveWebSocketUrl();
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[WebSocket] connected:', wsUrl);
      this.reconnectDelay = 1000;

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
        if (!message || typeof message !== 'object' || !('type' in message)) {
          console.warn('[WebSocket] received invalid message format:', event.data);
          return;
        }

        if (message.type === 'connected') {
          this.clientId = message.clientId;
        }

        this.listeners.forEach((listener) => {
          try {
            listener(message);
          } catch (error) {
            console.error('[WebSocket] listener error:', error);
          }
        });
      } catch (error) {
        console.error('[WebSocket] failed to parse message:', error, 'data:', event.data);
      }
    };

    this.ws.onclose = () => {
      console.log('[WebSocket] disconnected');
      this.ws = null;
      if (!this.isIntentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] error:', error);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      console.log(`[WebSocket] reconnecting in ${this.reconnectDelay}ms...`);
      this.connect();
    }, this.reconnectDelay);
  }

  disconnect() {
    this.isIntentionalClose = true;
    this.listeners.clear();
    this.messageQueue = [];

    if (this.ws) {
      this.ws.close();
      this.ws = null;
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
      this.messageQueue.push(message as unknown as WebSocketMessage);
      if (!this.ws) {
        this.connect();
      }
    }
  }

  subscribe(options: { eventTypes?: string[]; agentIds?: number[] }) {
    this.send({
      type: 'subscribe',
      eventTypes: options.eventTypes,
      agentIds: options.agentIds,
    });
  }

  unsubscribe(options: { eventTypes?: string[]; agentIds?: number[] }) {
    this.send({
      type: 'unsubscribe',
      eventTypes: options.eventTypes,
      agentIds: options.agentIds,
    });
  }

  onMessage(listener: WebSocketEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
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

export const wsClient = new WebSocketClient();
