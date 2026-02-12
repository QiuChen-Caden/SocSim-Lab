import { useMemo } from 'react';
import type { PersonaStats, SimulationState } from '../types';

export function useAgentStats(agents: SimulationState['agents']): PersonaStats | null {
  return useMemo(() => {
    const agentList = Object.values(agents);
    if (agentList.length === 0) return null;

    const totalAgents = agentList.length;

    // 统计分布
    const influenceTierDistribution: Record<string, number> = {};
    const groupDistribution: Record<string, number> = {};
    const ageBandDistribution: Record<string, number> = {};
    const genderDistribution: Record<string, number> = {};
    const sentimentDistribution: Record<string, number> = {};
    const economicBandDistribution: Record<string, number> = {};

    agentList.forEach((a) => {
      const t = a.profile.social_status.influence_tier;
      influenceTierDistribution[t] = (influenceTierDistribution[t] || 0) + 1;

      const g = a.profile.group;
      groupDistribution[g] = (groupDistribution[g] || 0) + 1;

      const ab = a.profile.identity.age_band;
      ageBandDistribution[ab] = (ageBandDistribution[ab] || 0) + 1;

      const gen = a.profile.identity.gender;
      genderDistribution[gen] = (genderDistribution[gen] || 0) + 1;

      const s = a.profile.cognitive_state.core_affect.sentiment;
      sentimentDistribution[s] = (sentimentDistribution[s] || 0) + 1;

      const eb = a.profile.social_status.economic_band;
      economicBandDistribution[eb] = (economicBandDistribution[eb] || 0) + 1;
    });

    // 计算平均值
    const avgMood = agentList.reduce((sum, a) => sum + a.state.mood, 0) / totalAgents;
    const avgStance = agentList.reduce((sum, a) => sum + a.state.stance, 0) / totalAgents;
    const avgResources = agentList.reduce((sum, a) => sum + a.state.resources, 0) / totalAgents;
    const avgCivility = agentList.reduce((sum, a) => sum + a.profile.behavior_profile.rhetoric_style.civility, 0) / totalAgents;
    const avgEvidenceCitation = agentList.reduce((sum, a) => sum + a.profile.behavior_profile.rhetoric_style.evidence_citation, 0) / totalAgents;

    // Topics统计
    const topicCounts: Record<string, number> = {};
    agentList.forEach((a) => {
      a.profile.cognitive_state.issue_stances.forEach((is) => {
        topicCounts[is.topic] = (topicCounts[is.topic] || 0) + 1;
      });
    });
    const topTopics = Object.entries(topicCounts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalAgents,
      influenceTierDistribution,
      groupDistribution,
      ageBandDistribution,
      genderDistribution,
      sentimentDistribution,
      avgMood,
      avgStance,
      avgResources,
      avgCivility,
      avgEvidenceCitation,
      topTopics,
      economicBandDistribution,
    };
  }, [agents]);
}
