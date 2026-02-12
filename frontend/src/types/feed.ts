import type { LogLevel } from './index';

export type SortMode = 'time' | 'emotion' | 'likes';
export type StreamFilter = 'all' | 'post' | 'event' | 'log' | 'llm';

export interface StreamItem {
  kind: 'post' | 'event' | 'log';
  id: string;
  tick: number;
  // Post fields
  authorName?: string;
  authorId?: number;
  content?: string;
  emotion?: number;
  likes?: number;
  // Event fields
  eventType?: string;
  title?: string;
  agentId?: number;
  // Log fields
  level?: LogLevel;
  text?: string;
}
