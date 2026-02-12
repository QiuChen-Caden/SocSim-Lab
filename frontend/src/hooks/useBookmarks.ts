import { useMemo } from 'react';
import type { TimelineEvent } from '../types';

export function useBookmarks(events: TimelineEvent[]) {
  return useMemo(() => {
    return events
      .filter((e) => e.type === 'bookmark')
      .sort((a, b) => b.tick - a.tick);
  }, [events]);
}
