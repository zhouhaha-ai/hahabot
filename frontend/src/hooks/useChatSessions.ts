import { useEffect, useState } from "react";

import type { ChatApiClient } from "../lib/api";
import type { ChatMessage, SessionSummary } from "../types/chat";

type UseChatSessionsResult = {
  activeSession: SessionSummary | null;
  activeMessages: ChatMessage[];
  activeSessionId: string | null;
  sessions: SessionSummary[];
  createSession: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
};

export function useChatSessions(apiClient: ChatApiClient): UseChatSessionsResult {
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    void loadInitialSessions();

    async function loadInitialSessions() {
      try {
        const listedSessions = sortSessions(await apiClient.listSessions());
        setSessions(listedSessions);

        if (listedSessions.length > 0) {
          await loadSession(listedSessions[0].id, listedSessions);
        }
      } catch {
        setSessions([]);
      }
    }
  }, [apiClient]);

  async function createSession() {
    const createdSession = await apiClient.createSession();
    const nextSessions = sortSessions([createdSession, ...sessions]);

    setSessions(nextSessions);
    setActiveSessionId(createdSession.id);
    setActiveMessages([]);
  }

  async function deleteSession(sessionId: string) {
    await apiClient.deleteSession(sessionId);

    const remainingSessions = sessions.filter((session) => session.id !== sessionId);
    setSessions(remainingSessions);

    if (remainingSessions.length === 0) {
      setActiveSessionId(null);
      setActiveMessages([]);
      return;
    }

    if (activeSessionId === sessionId) {
      await loadSession(remainingSessions[0].id, remainingSessions);
    }
  }

  async function selectSession(sessionId: string) {
    await loadSession(sessionId, sessions);
  }

  async function loadSession(sessionId: string, currentSessions: SessionSummary[]) {
    const detail = await apiClient.getSession(sessionId);
    setActiveSessionId(sessionId);
    setActiveMessages(detail.messages);

    setSessions(
      currentSessions.map((session) =>
        session.id === detail.session.id ? detail.session : session,
      ),
    );
  }

  return {
    activeSession: sessions.find((session) => session.id === activeSessionId) ?? null,
    activeMessages,
    activeSessionId,
    sessions,
    createSession,
    deleteSession,
    selectSession,
  };
}

function sortSessions(sessions: SessionSummary[]) {
  return [...sessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
