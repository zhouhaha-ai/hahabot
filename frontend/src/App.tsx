import { useChatSessions } from "./hooks/useChatSessions";
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
  } = useChatSessions(client);

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
        emptyStateTitle="Start a conversation"
        emptyStateDescription="Your session memory stays inside the active chat. Pick a chat or start a new one."
        messages={activeMessages}
        sessionTitle={activeSession?.title ?? null}
      />
    </div>
  );
}
