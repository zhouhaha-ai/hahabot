import { ChatPane } from "./components/ChatPane";
import { Sidebar } from "./components/Sidebar";

export function App() {
  return (
    <div className="app-shell">
      <Sidebar />
      <ChatPane
        emptyStateTitle="Start a conversation"
        emptyStateDescription="Your session memory stays inside the active chat. Pick a chat or start a new one."
      />
    </div>
  );
}
