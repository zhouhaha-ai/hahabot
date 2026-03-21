const sampleSessions = [
  {
    id: "draft-session",
    title: "Welcome chat",
    updatedAt: "Just now",
  },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__eyebrow">haha-chatbot</span>
        <h1>Memory stays in session</h1>
        <p>Simple chat workspace with resumable conversations.</p>
      </div>

      <button className="sidebar__new-chat" type="button">
        New Chat
      </button>

      <div className="sidebar__section">
        <div className="sidebar__section-header">
          <span>Recent Sessions</span>
        </div>

        <ul className="session-list" aria-label="Session history">
          {sampleSessions.map((session) => (
            <li key={session.id}>
              <button className="session-list__item session-list__item--active" type="button">
                <span className="session-list__title">{session.title}</span>
                <span className="session-list__meta">{session.updatedAt}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
