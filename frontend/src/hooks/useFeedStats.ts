import { useMemo } from 'react';
import type { FeedStats, FeedPost } from '../types';

export function useFeedStats(feed: FeedPost[]): FeedStats | null {
  return useMemo(() => {
    if (feed.length === 0) return null;
    const emotions = feed.map((p) => p.emotion);
    const avgEmotion = emotions.reduce((a, b) => a + b, 0) / emotions.length;
    const positiveCount = emotions.filter((e) => e > 0.2).length;
    const negativeCount = emotions.filter((e) => e < -0.2).length;
    const neutralCount = feed.length - positiveCount - negativeCount;
    const totalLikes = feed.reduce((sum, p) => sum + p.likes, 0);
    const avgLikes = totalLikes / feed.length;

    return {
      avgEmotion,
      positiveCount,
      negativeCount,
      neutralCount,
      totalLikes,
      avgLikes,
      mostEngaged: [...feed].sort((a, b) => b.likes - a.likes)[0],
    };
  }, [feed]);
}
