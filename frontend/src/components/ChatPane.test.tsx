import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../App";
import type { SessionDetail, SessionSummary } from "../types/chat";

function buildSession(id: string, title: string): SessionSummary {
  return {
    id,
    title,
    createdAt: "2026-03-21T10:00:00Z",
    updatedAt: "2026-03-21T11:00:00Z",
  };
}

function buildDetail(session: SessionSummary): SessionDetail {
  return {
    session,
    messages: [],
  };
}

function buildSseResponse(chunks: string[]) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }

        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
      },
    },
  );
}

it("appends streamed assistant text into a single bubble", async () => {
  const session = buildSession("session-1", "Most recent chat");
  const apiClient = {
    createSession: vi.fn(),
    listSessions: vi.fn().mockResolvedValue([session]),
    getSession: vi.fn().mockResolvedValue(buildDetail(session)),
    deleteSession: vi.fn(),
    streamMessage: vi.fn().mockResolvedValue(
      buildSseResponse([
        'event: start\ndata: {"session_id":"session-1"}\n\n',
        'event: delta\ndata: {"text":"Hi "}\n\n',
        'event: delta\ndata: {"text":"there"}\n\n',
        'event: done\ndata: {"message_id":"assistant-1","session_id":"session-1"}\n\n',
      ]),
    ),
  };
  const user = userEvent.setup();

  render(<App apiClient={apiClient} />);

  await user.type(await screen.findByPlaceholderText(/问问哈哈吧/i), "Hello");
  await user.click(screen.getByRole("button", { name: /发送消息/i }));

  expect(await screen.findByText("Hello")).toBeInTheDocument();
  expect(await screen.findByText("Hi there")).toBeInTheDocument();
});

it("marks the assistant bubble as failed when the stream errors", async () => {
  const session = buildSession("session-1", "Most recent chat");
  const apiClient = {
    createSession: vi.fn(),
    listSessions: vi.fn().mockResolvedValue([session]),
    getSession: vi.fn().mockResolvedValue(buildDetail(session)),
    deleteSession: vi.fn(),
    streamMessage: vi.fn().mockResolvedValue(
      buildSseResponse([
        'event: start\ndata: {"session_id":"session-1"}\n\n',
        'event: error\ndata: {"error":"boom"}\n\n',
      ]),
    ),
  };
  const user = userEvent.setup();

  render(<App apiClient={apiClient} />);

  await user.type(await screen.findByPlaceholderText(/问问哈哈吧/i), "Hello");
  await user.click(screen.getByRole("button", { name: /发送消息/i }));

  expect(await screen.findByText(/生成失败/i)).toBeInTheDocument();
});
