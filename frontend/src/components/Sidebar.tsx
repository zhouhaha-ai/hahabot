import type { SessionSummary } from "../types/chat";
import { SessionList } from "./SessionList";

type SidebarProps = {
  activeSessionId: string | null;
  onCreateSession: () => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onSelectSession: (sessionId: string) => Promise<void>;
  sessions: SessionSummary[];
};

export function Sidebar({
  activeSessionId,
  onCreateSession,
  onDeleteSession,
  onSelectSession,
  sessions,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-mark" aria-hidden="true">
          <span>☺</span>
        </div>
        <div className="sidebar__brand-copy">
          <h1>哈哈chatbot</h1>
          <p>您的会话管家</p>
        </div>
      </div>

      <button className="sidebar__new-chat" onClick={() => void onCreateSession()} type="button">
        <span className="sidebar__new-chat-icon" aria-hidden="true">
          +
        </span>
        <span>新聊天</span>
      </button>

      <div className="sidebar__section">
        <div className="sidebar__section-header">
          <span>最近历史</span>
        </div>

        <SessionList
          activeSessionId={activeSessionId}
          onDeleteSession={onDeleteSession}
          onSelectSession={onSelectSession}
          sessions={sessions}
        />
      </div>
    </aside>
  );
}
