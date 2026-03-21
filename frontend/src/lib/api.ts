import type { SessionDetail, SessionSummary } from "../types/chat";

export class ApiClient {
  constructor(private readonly baseUrl = "/api") {}

  async createSession(): Promise<SessionSummary> {
    return this.request<SessionSummary>("/sessions", {
      method: "POST",
    });
  }

  async listSessions(): Promise<SessionSummary[]> {
    return this.request<SessionSummary[]>("/sessions");
  }

  async getSession(sessionId: string): Promise<SessionDetail> {
    return this.request<SessionDetail>(`/sessions/${sessionId}`);
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
