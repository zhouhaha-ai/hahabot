import type { ChatMessage } from "../types/chat";

type ChatPaneProps = {
  emptyStateTitle: string;
  emptyStateDescription: string;
  sessionTitle: string | null;
  messages: ChatMessage[];
};

export function ChatPane({
  emptyStateTitle,
  emptyStateDescription,
  sessionTitle,
  messages,
}: ChatPaneProps) {
  const isEmpty = messages.length === 0;

  return (
    <main className="chat-pane">
      <header className="chat-pane__header">
        <div>
          <span className="chat-pane__eyebrow">Active Session</span>
          <h2>{sessionTitle ?? "Untitled Session"}</h2>
        </div>
        <span className="chat-pane__status">Ready</span>
      </header>

      {isEmpty ? (
        <section className="chat-pane__empty-state">
          <div className="chat-pane__empty-card">
            <span className="chat-pane__empty-badge">Empty Session</span>
            <h3>{emptyStateTitle}</h3>
            <p>{emptyStateDescription}</p>
          </div>
        </section>
      ) : (
        <section className="chat-pane__messages" aria-label="Message transcript" />
      )}
    </main>
  );
}
