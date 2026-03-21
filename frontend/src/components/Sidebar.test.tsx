import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../App";
import type { ChatMessage, SessionDetail, SessionSummary } from "../types/chat";

function buildSession(id: string, title: string, updatedAt: string): SessionSummary {
  return {
    id,
    title,
    createdAt: "2026-03-21T10:00:00Z",
    updatedAt,
  };
}

function buildDetail(session: SessionSummary, messages: ChatMessage[] = []): SessionDetail {
  return { session, messages };
}

it("loads sessions and selects the newest session", async () => {
  const olderSession = buildSession("session-1", "Earlier chat", "2026-03-21T10:00:00Z");
  const newerSession = buildSession("session-2", "Most recent chat", "2026-03-21T11:00:00Z");
  const apiClient = {
    createSession: vi.fn(),
    listSessions: vi.fn().mockResolvedValue([olderSession, newerSession]),
    getSession: vi.fn().mockResolvedValue(buildDetail(newerSession)),
    deleteSession: vi.fn(),
  };

  render(<App apiClient={apiClient} />);

  const history = await screen.findByRole("list", { name: /session history/i });
  expect(within(history).getByText("Most recent chat")).toBeInTheDocument();
  expect(apiClient.getSession).toHaveBeenCalledWith("session-2");
});

it("deletes the active session and falls back to empty state", async () => {
  const session = buildSession("session-1", "Most recent chat", "2026-03-21T11:00:00Z");
  const apiClient = {
    createSession: vi.fn(),
    listSessions: vi.fn().mockResolvedValue([session]),
    getSession: vi.fn().mockResolvedValue(buildDetail(session)),
    deleteSession: vi.fn().mockResolvedValue({ ok: true }),
  };
  const user = userEvent.setup();

  render(<App apiClient={apiClient} />);

  await user.click(await screen.findByRole("button", { name: /delete session/i }));

  expect(await screen.findByText(/start a conversation/i)).toBeInTheDocument();
});
