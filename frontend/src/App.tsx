import type { ChatMessage } from "./types/chat";
import { useChatSessions } from "./hooks/useChatSessions";
import { useChatStream } from "./hooks/useChatStream";
import { apiClient, type ChatApiClient } from "./lib/api";
import { ChatPane } from "./components/ChatPane";
import { Sidebar } from "./components/Sidebar";

type AppProps = {
  apiClient?: ChatApiClient;
};

export function App({ apiClient: client = apiClient }: AppProps) {
  const {
    activeSession,
    activeMessages,
    activeSessionId,
    sessions,
    createSession,
    deleteSession,
    selectSession,
    setActiveMessages,
  } = useChatSessions(client);
  const { isStreaming, sendMessage } = useChatStream(client);

  async function handleSendMessage(content: string) {
    if (activeSessionId === null) {
      return;
    }

    const createdAt = new Date().toISOString();
    const userMessageId = makeLocalId("user");
    const assistantMessageId = makeLocalId("assistant");

    setActiveMessages((current) => [
      ...current,
      {
        id: userMessageId,
        role: "user",
        content,
        sequence: current.length + 1,
        createdAt,
        status: "complete",
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        sequence: current.length + 2,
        createdAt,
        status: "streaming",
      },
    ]);

    await sendMessage({
      message: content,
      sessionId: activeSessionId,
      onDelta(text) {
        setActiveMessages((current) =>
          patchAssistantMessage(current, assistantMessageId, (message) => ({
            ...message,
            content: `${message.content}${text}`,
          })),
        );
      },
      onDone(messageId) {
        setActiveMessages((current) =>
          patchAssistantMessage(current, assistantMessageId, (message) => ({
            ...message,
            id: messageId,
            status: "complete",
          })),
        );
      },
      onError(error) {
        setActiveMessages((current) =>
          patchAssistantMessage(current, assistantMessageId, (message) => ({
            ...message,
            status: "failed",
            errorMessage: error,
          })),
        );
      },
    });
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeSessionId={activeSessionId}
        onCreateSession={createSession}
        onDeleteSession={deleteSession}
        onSelectSession={selectSession}
        sessions={sessions}
      />
      <ChatPane
        canSendMessage={activeSessionId !== null}
        isStreaming={isStreaming}
        messages={activeMessages}
        onSendMessage={handleSendMessage}
        sessionTitle={activeSession?.title ?? null}
      />
    </div>
  );
}

function makeLocalId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function patchAssistantMessage(
  messages: ChatMessage[],
  messageId: string,
  update: (message: ChatMessage) => ChatMessage,
) {
  return messages.map((message) => (message.id === messageId ? update(message) : message));
}
