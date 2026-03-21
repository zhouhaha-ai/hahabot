type ChatPaneProps = {
  emptyStateTitle: string;
  emptyStateDescription: string;
};

export function ChatPane({
  emptyStateTitle,
  emptyStateDescription,
}: ChatPaneProps) {
  return (
    <main className="chat-pane">
      <header className="chat-pane__header">
        <div>
          <span className="chat-pane__eyebrow">Active Session</span>
          <h2>Untitled Session</h2>
        </div>
        <span className="chat-pane__status">Ready</span>
      </header>

      <section className="chat-pane__empty-state">
        <div className="chat-pane__empty-card">
          <span className="chat-pane__empty-badge">Empty Session</span>
          <h3>{emptyStateTitle}</h3>
          <p>{emptyStateDescription}</p>
        </div>
      </section>
    </main>
  );
}
