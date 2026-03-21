import type { SessionDetail, SessionSummary } from "../types/chat";

type BackendSessionSummary = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

type BackendChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sequence: number;
  created_at: string;
};

type BackendSessionDetail = {
  session: BackendSessionSummary;
  messages: BackendChatMessage[];
};

export interface ChatApiClient {
  createSession(): Promise<SessionSummary>;
  listSessions(): Promise<SessionSummary[]>;
  getSession(sessionId: string): Promise<SessionDetail>;
  deleteSession(sessionId: string): Promise<{ ok: boolean }>;
}

export class ApiClient implements ChatApiClient {
  constructor(private readonly baseUrl = "/api") {}

  async createSession(): Promise<SessionSummary> {
    const session = await this.request<BackendSessionSummary>("/sessions", {
      method: "POST",
    });
    return mapSessionSummary(session);
  }

  async listSessions(): Promise<SessionSummary[]> {
    const sessions = await this.request<BackendSessionSummary[]>("/sessions");
    return sessions.map(mapSessionSummary);
  }

  async getSession(sessionId: string): Promise<SessionDetail> {
    const detail = await this.request<BackendSessionDetail>(`/sessions/${sessionId}`);
    return {
      session: mapSessionSummary(detail.session),
      messages: detail.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        sequence: message.sequence,
        createdAt: message.created_at,
      })),
    };
  }

  async deleteSession(sessionId: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(`/sessions/${sessionId}`, {
      method: "DELETE",
    });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  }
}

export const apiClient = new ApiClient();

function mapSessionSummary(session: BackendSessionSummary): SessionSummary {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}
