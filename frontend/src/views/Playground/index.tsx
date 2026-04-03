import { useCallback, useEffect, useRef, useState } from 'react';
import { useSim } from '../../app/SimulationProvider';
import { PixiTown } from './PixiTown';
import { AgentInfoCard } from './AgentInfoCard';
import { ZONE_MAP, defaultZoneForAgent } from './townLayout';
import type { TownZoneId } from '../../types';
import './playground.css';

export function PlaygroundView() {
  const { state, actions } = useSim();
  const [selectedInfo, setSelectedInfo] = useState<{ agentId: number; sx: number; sy: number } | null>(null);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Init user agent + assign default zones on mount
  useEffect(() => {
    actions.initUserAgent();
    // Assign default zones for all agents that don't have one
    for (const [idStr, agent] of Object.entries(state.agents)) {
      const agentId = Number(idStr);
      if (!state.playground.agentZones[agentId]) {
        actions.setAgentZone(agentId, defaultZoneForAgent(agentId, agent.profile.group));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mock chat generation: every ~25 ticks, random same-zone pair chats
  const lastMockChatTick = useRef(0);
  useEffect(() => {
    const tick = state.tick;
    if (tick - lastMockChatTick.current < 25) return;
    lastMockChatTick.current = tick;

    const zones = state.playground.agentZones;
    const zoneAgents: Record<string, number[]> = {};
    for (const [idStr, zoneId] of Object.entries(zones)) {
      const aid = Number(idStr);
      if (aid === 31) continue;
      if (!zoneAgents[zoneId]) zoneAgents[zoneId] = [];
      zoneAgents[zoneId].push(aid);
    }

    const mockTexts = [
      'This is interesting...', 'I agree with that.', 'Not sure about this.',
      'Let me think...', 'Great point!', 'We should discuss more.',
      'I have a different view.', 'Fascinating!', 'Tell me more.',
    ];

    for (const agents of Object.values(zoneAgents)) {
      if (agents.length < 2 || Math.random() > 0.3) continue;
      const i = Math.floor(Math.random() * agents.length);
      const aid = agents[i];
      const text = mockTexts[Math.floor(Math.random() * mockTexts.length)];
      actions.pushChatBubble(aid, text);
      break; // One bubble per cycle
    }

    actions.clearExpiredBubbles(tick);
  }, [state.tick, actions]);

  const handleSelectAgent = useCallback((agentId: number, sx: number, sy: number) => {
    setSelectedInfo({ agentId, sx, sy });
    actions.selectAgent(agentId);
  }, [actions]);

  const handleAgentDrop = useCallback((agentId: number, zoneId: TownZoneId) => {
    actions.setAgentZone(agentId, zoneId);
  }, [actions]);

  const handleReply = useCallback((username: string) => {
    setReplyTarget(username);
    setSelectedInfo(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handlePost = useCallback(() => {
    const input = inputRef.current;
    if (!input || !input.value.trim()) return;
    const content = input.value.trim();
    if (replyTarget) {
      actions.userReply(replyTarget, content);
    } else {
      actions.userPost(content);
    }
    input.value = '';
    setReplyTarget(null);
  }, [actions, replyTarget]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handlePost();
  }, [handlePost]);

  // Get selected agent data
  const selAgent = selectedInfo ? state.agents[selectedInfo.agentId] : null;
  const selZone = selectedInfo ? state.playground.agentZones[selectedInfo.agentId] : null;
  const selPosts = selectedInfo
    ? state.feed.filter(p => p.authorId === selectedInfo.agentId).slice(-3)
    : [];

  return (
    <div className="playground">
      <div className="playground__canvas">
        <PixiTown onSelectAgent={handleSelectAgent} onAgentDrop={handleAgentDrop} />
        {selAgent && selectedInfo && (
          <AgentInfoCard
            profile={selAgent.profile}
            agentState={selAgent.state}
            recentPosts={selPosts}
            screenX={selectedInfo.sx}
            screenY={selectedInfo.sy}
            zoneName={selZone ? `${ZONE_MAP[selZone].label} ${ZONE_MAP[selZone].labelCn}` : 'Unknown'}
            onClose={() => setSelectedInfo(null)}
            onReply={handleReply}
          />
        )}
      </div>
      <div className="playground__bar">
        {replyTarget && (
          <span className="playground__reply-tag">
            @{replyTarget}
            <button onClick={() => setReplyTarget(null)}>×</button>
          </span>
        )}
        <input
          ref={inputRef}
          placeholder="Say something in the town..."
          onKeyDown={handleKeyDown}
        />
        <button onClick={handlePost}>Post</button>
      </div>
    </div>
  );
}
