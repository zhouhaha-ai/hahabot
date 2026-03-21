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
        <span className="sidebar__eyebrow">haha-chatbot</span>
        <h1>Memory stays in session</h1>
        <p>Simple chat workspace with resumable conversations.</p>
      </div>

      <button className="sidebar__new-chat" onClick={() => void onCreateSession()} type="button">
        New Chat
      </button>

      <div className="sidebar__section">
        <div className="sidebar__section-header">
          <span>Recent Sessions</span>
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
