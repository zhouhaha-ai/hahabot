import type { ChatMessage } from "../types/chat";

type MessageListProps = {
  messages: ChatMessage[];
};

export function MessageList({ messages }: MessageListProps) {
  return (
    <ol className="message-list" aria-label="Message transcript">
      {messages.map((message) => (
        <li
          className={`message-list__row message-list__row--${message.role}`}
          key={message.id}
        >
          <article className={`message-bubble message-bubble--${message.role}`}>
            <span className="message-bubble__label">
              {message.role === "user" ? "你" : "哈哈机器人"}
            </span>
            <p>{message.content}</p>
            {message.role === "assistant" && message.status === "failed" ? (
              <span className="message-bubble__status">生成失败</span>
            ) : null}
          </article>
        </li>
      ))}
    </ol>
  );
}
