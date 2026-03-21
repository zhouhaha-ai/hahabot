import { useState } from "react";

type ComposerProps = {
  disabled: boolean;
  isStreaming: boolean;
  onSend: (message: string) => Promise<void>;
};

export function Composer({ disabled, isStreaming, onSend }: ComposerProps) {
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = message.trim();
    if (trimmed === "" || disabled || isStreaming) {
      return;
    }

    await onSend(trimmed);
    setMessage("");
  }

  return (
    <form className="composer" onSubmit={(event) => void handleSubmit(event)}>
      <button className="composer__attach" type="button" aria-label="附件">
        <span aria-hidden="true">+</span>
      </button>
      <textarea
        className="composer__input"
        disabled={disabled}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="问问哈哈吧..."
        rows={1}
        value={message}
      />
      <button
        aria-label="发送消息"
        className="composer__submit"
        disabled={disabled || isStreaming}
        type="submit"
      >
        <span aria-hidden="true">{isStreaming ? "…" : "↑"}</span>
      </button>
    </form>
  );
}
