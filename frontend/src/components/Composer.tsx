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
      <textarea
        className="composer__input"
        disabled={disabled}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Send a message"
        rows={3}
        value={message}
      />
      <button className="composer__submit" disabled={disabled || isStreaming} type="submit">
        {isStreaming ? "Streaming..." : "Send"}
      </button>
    </form>
  );
}
