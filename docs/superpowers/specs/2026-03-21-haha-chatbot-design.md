# Haha Chatbot Design

## Overview

`haha-chatbot` is a single-user full-stack chat application built from an existing Stitch UI design. The application supports:

- Creating a new chat session
- Listing historical sessions
- Opening a historical session
- Continuing a historical session with its prior context
- Deleting a session
- Streaming assistant responses over Server-Sent Events (SSE)

The product does not include authentication, multi-user isolation, search, rename, archive, or cross-session memory. Memory is scoped strictly to the active chat session: each model request includes only messages that belong to the current `session_id`.

## Goals

- Deliver a clean MVP aligned with the Stitch design
- Persist chat history in PostgreSQL
- Restore context when the user continues an existing session
- Stream `qwen-plus` responses in real time with SSE
- Package the app for Docker deployment on a single Tencent Cloud server

## Non-Goals

- User login, roles, or permissions
- Cross-session memory or summarization
- Redis, background jobs, or message queues
- Search, pinning, archiving, or manual rename of sessions
- Rich media messages, file upload, or markdown editing
- Horizontal scaling or multi-region deployment

## Product Decisions

- Single-user application with no authentication
- Session titles are generated from the first user message
- Historical sessions are reopenable and can continue the conversation
- Streaming uses SSE, not WebSocket
- Session management is limited to create, list, open, continue, and delete
- PostgreSQL is the only persistence layer; Redis is intentionally excluded for MVP

## Architecture

The system uses a straightforward three-service layout:

1. `frontend`: React single-page application
2. `backend`: FastAPI application
3. `postgres`: PostgreSQL database

All services are orchestrated with Docker Compose for local development and the first production deployment.

### Frontend Responsibilities

- Render the Stitch-based chat UI
- Manage the active session and session list
- Fetch session history from the backend
- Start SSE requests for new assistant responses
- Render incremental assistant output as the stream arrives
- Surface request, stream, and deletion errors to the user

### Backend Responsibilities

- Expose session CRUD and message retrieval endpoints
- Persist user and assistant messages in PostgreSQL
- Load the current session history before each model request
- Call the `qwen-plus` model using the configured API key
- Convert model output into SSE events for the frontend
- Generate the initial session title from the first user message

### Database Responsibilities

- Persist chat sessions and ordered messages
- Provide recent-session ordering via `updated_at`
- Guarantee message ordering within a session

## Data Model

### Table: `chat_sessions`

- `id`: UUID primary key
- `title`: nullable text during session creation; filled from first user message
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Responsibilities:

- Represents a logical conversation container
- Drives sidebar ordering through `updated_at`
- Stores the display title shown in the session history list

### Table: `chat_messages`

- `id`: UUID primary key
- `session_id`: UUID foreign key to `chat_sessions.id`
- `role`: enum-like text constrained to `user`, `assistant`, `system`
- `content`: text
- `sequence`: integer scoped to the session
- `created_at`: timestamp with time zone

Responsibilities:

- Stores the exact ordered transcript for one session
- Supports rebuilding model context for continued conversations
- Allows deterministic rendering and debugging of stream output

### Message Ordering

The backend assigns `sequence` numbers monotonically within each session. Reads sort by `sequence ASC`, using `created_at` only as a fallback for diagnostics. This avoids ambiguous ordering if timestamps are equal.

## API Design

All backend routes are namespaced under `/api`.

### Session Endpoints

#### `POST /api/sessions`

Creates an empty session and returns the new `session_id`.

Response shape:

```json
{
  "id": "uuid",
  "title": null,
  "created_at": "2026-03-21T03:00:00Z",
  "updated_at": "2026-03-21T03:00:00Z"
}
```

#### `GET /api/sessions`

Returns the sidebar session list sorted by `updated_at DESC`.

Response shape:

```json
[
  {
    "id": "uuid",
    "title": "Explain Docker Compose setup",
    "created_at": "2026-03-21T03:00:00Z",
    "updated_at": "2026-03-21T03:05:00Z"
  }
]
```

#### `GET /api/sessions/{session_id}`

Returns the session metadata and all messages for the selected session.

Response shape:

```json
{
  "session": {
    "id": "uuid",
    "title": "Explain Docker Compose setup",
    "created_at": "2026-03-21T03:00:00Z",
    "updated_at": "2026-03-21T03:05:00Z"
  },
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "How should I deploy this?",
      "sequence": 1,
      "created_at": "2026-03-21T03:00:05Z"
    }
  ]
}
```

#### `DELETE /api/sessions/{session_id}`

Deletes the target session and its messages. MVP will use hard delete to keep the schema and behavior simple.

Response shape:

```json
{
  "ok": true
}
```

### Chat Streaming Endpoint

#### `POST /api/sessions/{session_id}/messages/stream`

Accepts one user message, persists it, loads the session transcript, calls `qwen-plus`, and streams the assistant reply over SSE.

Request shape:

```json
{
  "message": "你好，介绍一下你自己"
}
```

SSE event contract:

- `start`: backend accepted the request and started generation
- `delta`: incremental assistant text chunk
- `done`: generation completed successfully; includes persisted assistant message metadata
- `error`: generation failed; includes a user-safe error message

Example stream:

```text
event: start
data: {"session_id":"uuid"}

event: delta
data: {"text":"你好，"}

event: delta
data: {"text":"我是 Haha Chatbot。"}

event: done
data: {"message_id":"uuid","session_id":"uuid"}
```

## Chat Request Lifecycle

For each user message:

1. Validate that the session exists and the message is non-empty
2. Insert the user message into `chat_messages`
3. If this is the first user message and the session title is empty, derive the title from the message and update the session
4. Query all messages for that `session_id` ordered by `sequence`
5. Convert the transcript into the model input format for `qwen-plus`
6. Start an SSE response and emit `start`
7. Forward model deltas as `delta` events
8. Accumulate the full assistant response server-side during streaming
9. When the model finishes, insert the complete assistant message into `chat_messages`
10. Update the session `updated_at`
11. Emit `done`

If generation fails after the user message is saved, the backend emits `error` and does not persist a partial assistant message.

## Title Generation

Session titles are generated only once, from the first user message in that session.

Rules:

- Trim leading and trailing whitespace
- Collapse excessive internal whitespace
- Use the first 20 to 30 visible characters as the display title
- Do not call the model to summarize titles in MVP

This keeps titles deterministic, fast, and free from extra API cost.

## Frontend UX Design

The frontend follows the existing Stitch concept: a two-pane desktop-first chat experience with a left sidebar and main conversation stage.

### Sidebar

- Product branding at the top
- `New Chat` primary action
- Session history list sorted by recent activity
- Selected-state styling for the active session
- Per-session delete action

### Main Chat Area

- Session title near the top
- Empty-state welcome view when a session has no messages
- Scrollable message list once messages exist
- Bottom-aligned input composer with send action

### Message Rendering

- User messages are visually distinct and right-aligned
- Assistant messages are left-aligned
- Streaming assistant responses render progressively in a single in-flight bubble
- During streaming, duplicate submits are disabled to avoid out-of-order assistant messages

### Session Interactions

#### New Session

- Frontend creates a fresh session
- Sidebar updates immediately
- Main panel shows the empty-state view
- First sent message triggers title generation on the backend

#### Open Existing Session

- Frontend fetches full session details
- Main panel renders the stored transcript
- New sends continue the same conversation context

#### Delete Session

- Frontend asks for lightweight confirmation
- On success, removes the deleted session from local state
- If the deleted session is active, the UI selects the next most recent session or returns to an empty-state view if none remain

## Frontend State Model

The MVP should keep client state lean:

- `sessionList`
- `activeSessionId`
- `messages`
- `isStreaming`
- `streamError`

No Redux or global event bus is required. Standard React state plus small service modules is sufficient.

## Error Handling

### Frontend

- Block empty message submission
- Show a non-disruptive error banner or inline notice when session fetch/delete fails
- Mark the in-flight assistant bubble as failed if the SSE stream ends with `error`
- Preserve any partial streamed text already shown to the user

### Backend

- Return `404` for unknown `session_id`
- Return `400` for empty or invalid message payloads
- Return `500` for unexpected persistence errors
- Emit SSE `error` for model or streaming failures

### Persistence Policy on Failure

- Always persist the user message before model generation begins
- Persist the assistant message only after the full response is assembled successfully
- Do not store partial assistant output for MVP

This keeps history clean and avoids half-written assistant transcripts.

## Testing Strategy

### Backend Tests

- Session title generation from the first user message
- Correct message ordering and sequence assignment
- Context reconstruction uses only the active session transcript
- Session CRUD endpoints behave as expected
- Streaming endpoint emits `start`, `delta`, `done`, and `error` correctly

### Frontend Tests

- Session list loads and sorts correctly
- Selecting a session loads its transcript
- Sending a message opens the stream and appends incremental text
- Deleting a session updates the active view correctly
- Empty submissions are blocked

### Integration Coverage

At least one end-to-end local verification path should cover:

1. Create session
2. Send first user message
3. Receive streamed assistant output
4. Refresh and confirm history remains visible
5. Reopen the same session and continue chatting with preserved context

Model integration tests should mock the Qwen client. Real API calls belong in manual verification only.

## Security and Configuration

The system requires environment-based configuration for all sensitive settings:

- `QWEN_API_KEY`
- `QWEN_MODEL=qwen-plus`
- `DATABASE_URL`
- frontend API base URL settings as needed

Secrets must not be committed to git. The user-provided API key and server password should be treated as operational secrets and rotated if they were exposed anywhere outside a trusted channel.

## Deployment Plan

Initial deployment target: one Tencent Cloud Ubuntu server using Docker Compose.

Containers:

- `frontend`
- `backend`
- `postgres`

Deployment expectations:

- PostgreSQL data persists via a Docker volume
- Backend and frontend are configured through environment variables
- SSE connections must be preserved correctly by the serving stack
- The first release can avoid Redis and background workers

An additional reverse proxy such as Nginx can be added later if needed for TLS termination or routing, but it is not required to validate the MVP architecture.

## Suggested Repository Structure

```text
haha-chatbot/
  frontend/
  backend/
  deploy/
  docs/
  .env.example
  docker-compose.yml
  README.md
```

## Open Questions Resolved in This Spec

- Authentication: excluded
- Session continuation: supported
- Streaming: SSE required
- Title generation: first user message
- Session management scope: create, list, open, continue, delete
- Redis: not required

## Implementation Readiness

This spec is intentionally scoped to a single MVP plan:

- One frontend app
- One backend API service
- One database
- One deployment topology

It avoids optional subsystems so implementation planning can proceed without splitting the work into multiple specs.
