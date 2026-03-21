import type { SessionSummary } from "../types/chat";

type SessionListProps = {
  activeSessionId: string | null;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onSelectSession: (sessionId: string) => Promise<void>;
  sessions: SessionSummary[];
};

export function SessionList({
  activeSessionId,
  onDeleteSession,
  onSelectSession,
  sessions,
}: SessionListProps) {
  if (sessions.length === 0) {
    return <p className="session-list__empty">还没有历史会话</p>;
  }

  return (
    <ul className="session-list" aria-label="Session history">
      {sessions.map((session) => {
        const isActive = session.id === activeSessionId;
        const title = session.title ?? "Untitled Session";

        return (
          <li className="session-list__row" key={session.id}>
            <button
              className={`session-list__item${isActive ? " session-list__item--active" : ""}`}
              onClick={() => void onSelectSession(session.id)}
              type="button"
            >
              <span className="session-list__icon" aria-hidden="true">
                {isActive ? "●" : "◦"}
              </span>
              <span className="session-list__title">{title}</span>
              <span className="session-list__meta">{formatUpdatedAt(session.updatedAt)}</span>
            </button>
            <button
              aria-label={`Delete session ${title}`}
              className="session-list__delete"
              onClick={() => void onDeleteSession(session.id)}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function formatUpdatedAt(updatedAt: string) {
  return new Date(updatedAt).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
