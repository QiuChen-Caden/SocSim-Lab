import type { AgentProfile, GroupProfile } from '../../types';

export function createUserAgentProfile(groups: Record<string, GroupProfile>): AgentProfile {
  const group = groups['Group A'] ?? {
    key: 'Group A',
    label: 'Civic Elite',
    dominantStratum: 'middle' as const,
    cohesion: 0.5,
    polarization: 0.5,
    trustClimate: 0.5,
    normSummary: 'n/a',
  };

  return {
    id: 31,
    name: 'You (Player)',
    group: group.key,
    identity: {
      username: 'You_Player',
      age_band: '25-34',
      gender: 'unknown',
      location: { country: 'Simulation', region_city: 'Pixel Town' },
      profession: 'observer',
      domain_of_expertise: ['social simulation', 'community engagement'],
    },
    psychometrics: {
      personality: { big_five: { O: 0.7, C: 0.6, E: 0.65, A: 0.7, N: 0.35 } },
      values: { moral_foundations: { care: 0.7, fairness: 0.7, loyalty: 0.6, authority: 0.5, sanctity: 0.5 } },
    },
    social_status: {
      influence_tier: 'opinion_leader',
      economic_band: 'medium',
      social_capital: { network_size_proxy: 2 },
    },
    behavior_profile: {
      posting_cadence: { posts_per_day: 5, diurnal_pattern: ['morning', 'evening'] },
      rhetoric_style: { civility: 0.9, evidence_citation: 0.6 },
    },
    cognitive_state: {
      core_affect: { sentiment: 'calm', arousal: 0.4 },
      issue_stances: [{ topic: 'social simulation', support: 0.8, certainty: 0.7 }],
    },
  };
}
