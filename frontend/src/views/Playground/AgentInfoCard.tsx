import type { CSSProperties } from 'react';
import type { AgentProfile, AgentState, FeedPost } from '../../types';

interface AgentInfoCardProps {
  profile: AgentProfile;
  agentState: AgentState;
  recentPosts: FeedPost[];
  screenX: number;
  screenY: number;
  zoneName: string;
  onClose: () => void;
  onReply: (username: string) => void;
}

function moodColor(mood: number): string {
  if (mood < -0.3) return '#f38ba8';
  if (mood > 0.3) return '#a6e3a1';
  return '#f9e2af';
}

function barPercent(v: number, min = 0, max = 1): number {
  return Math.round(((v - min) / (max - min)) * 100);
}

export function AgentInfoCard({
  profile, agentState, recentPosts, screenX, screenY, zoneName, onClose, onReply,
}: AgentInfoCardProps) {
  const bf = profile.psychometrics.personality.big_five;
  const isUser = profile.id === 31;

  // Position card near click but keep on screen
  const style: CSSProperties = {
    left: Math.max(0, Math.min(screenX + 12, window.innerWidth - 200)),
    top: Math.max(0, Math.min(screenY - 40, window.innerHeight - 400)),
  };

  return (
    <div className="agent-card" style={style} onClick={e => e.stopPropagation()}>
      <div className="agent-card__header">
        <span className="agent-card__name">
          {isUser ? '🎮 ' : ''}@{profile.identity.username}
        </span>
        <span className="agent-card__group">{profile.group}</span>
        <button className="agent-card__close" onClick={onClose}>×</button>
      </div>

      {/* Mood */}
      <div className="agent-card__row">
        <span className="agent-card__label">Mood</span>
        <div className="agent-card__bar">
          <div
            className="agent-card__bar-fill"
            style={{
              width: `${barPercent(agentState.mood, -1, 1)}%`,
              background: moodColor(agentState.mood),
            }}
          />
        </div>
        <span style={{ fontSize: 11, minWidth: 32, textAlign: 'right' }}>
          {agentState.mood.toFixed(2)}
        </span>
      </div>

      {/* Stance */}
      <div className="agent-card__row">
        <span className="agent-card__label">Stance</span>
        <div className="agent-card__bar">
          <div
            className="agent-card__bar-fill"
            style={{
              width: `${barPercent(agentState.stance, -1, 1)}%`,
              background: '#89b4fa',
            }}
          />
        </div>
        <span style={{ fontSize: 11, minWidth: 32, textAlign: 'right' }}>
          {agentState.stance.toFixed(2)}
        </span>
      </div>

      {/* Resources */}
      <div className="agent-card__row">
        <span className="agent-card__label">Resources</span>
        <span>{agentState.resources}</span>
      </div>

      {/* Zone */}
      <div className="agent-card__row">
        <span className="agent-card__label">Zone</span>
        <span>{zoneName}</span>
      </div>

      {/* Big Five */}
      <div className="agent-card__section">
        <div className="agent-card__section-title">Big Five</div>
        {(['O', 'C', 'E', 'A', 'N'] as const).map(k => (
          <div className="agent-card__row" key={k}>
            <span className="agent-card__label" style={{ minWidth: 20 }}>{k}</span>
            <div className="agent-card__bar">
              <div
                className="agent-card__bar-fill"
                style={{ width: `${barPercent(bf[k])}%`, background: '#cba6f7' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <div className="agent-card__section">
          <div className="agent-card__section-title">Recent Posts</div>
          {recentPosts.slice(0, 3).map(p => (
            <div className="agent-card__post" key={p.id}>
              {p.content.length > 60 ? p.content.slice(0, 60) + '...' : p.content}
            </div>
          ))}
        </div>
      )}

      {!isUser && (
        <button className="agent-card__reply-btn" onClick={() => onReply(profile.identity.username)}>
          Reply to @{profile.identity.username}
        </button>
      )}
    </div>
  );
}
