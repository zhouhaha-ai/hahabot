# Haha Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Stitch-based full-stack chat application with session-scoped memory, persisted history, SSE streaming responses, and Docker deployment.

**Architecture:** The repository will be a small monorepo with a React + TypeScript frontend, a FastAPI backend, and PostgreSQL persistence. The backend owns session/message storage and streams `qwen-plus` output over `text/event-stream`; the frontend uses `fetch` plus a stream parser instead of browser `EventSource` because the chat API is a `POST` endpoint with a request body.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, React Testing Library, FastAPI, SQLAlchemy 2.x, Alembic, PostgreSQL, OpenAI Python SDK against DashScope compatible mode, Docker Compose

---

## File Structure

### Root

- Create: `.gitignore` - ignore Python, Node, env, and Docker artifacts
- Create: `.env.example` - document required runtime variables
- Create: `docker-compose.yml` - wire frontend, backend, and postgres containers
- Create: `README.md` - local setup, test, and deployment commands
- Create: `deploy/tencent-cloud.md` - server deployment checklist

### Backend

- Create: `backend/pyproject.toml` - Python dependencies and pytest config entry point
- Create: `backend/alembic.ini` - Alembic runtime configuration
- Create: `backend/alembic/env.py` - migration environment wiring
- Create: `backend/alembic/versions/20260321_01_create_chat_tables.py` - initial schema migration
- Create: `backend/Dockerfile` - backend image build
- Create: `backend/app/main.py` - FastAPI application bootstrap
- Create: `backend/app/core/config.py` - environment-backed settings
- Create: `backend/app/db/session.py` - SQLAlchemy engine and session factory
- Create: `backend/app/db/models.py` - `chat_sessions` and `chat_messages` ORM models
- Create: `backend/app/services/transcript_service.py` - model input assembly from session messages
- Create: `backend/app/repositories/sessions.py` - session CRUD queries
- Create: `backend/app/repositories/messages.py` - message insert/list queries
- Create: `backend/app/schemas/session.py` - API request/response models for sessions
- Create: `backend/app/schemas/chat.py` - chat request and SSE payload schemas
- Create: `backend/app/services/title_service.py` - first-message title generation
- Create: `backend/app/services/qwen_client.py` - Qwen-compatible streaming client
- Create: `backend/app/services/chat_service.py` - chat orchestration and persistence flow
- Create: `backend/app/services/sse.py` - SSE event formatting helpers
- Create: `backend/app/api/routes/sessions.py` - create/list/get/delete routes
- Create: `backend/app/api/routes/chat.py` - stream chat route
- Create: `backend/tests/conftest.py` - shared fixtures, test DB session, fake model client
- Create: `backend/tests/api/test_sessions.py` - session endpoint coverage
- Create: `backend/tests/api/test_chat_stream.py` - streaming endpoint coverage
- Create: `backend/tests/services/test_title_service.py` - title generation coverage
- Create: `backend/tests/services/test_transcript_service.py` - transcript assembly coverage

### Frontend

- Create: `frontend/package.json` - React scripts and dependencies
- Create: `frontend/tsconfig.json` - TypeScript config
- Create: `frontend/vite.config.ts` - Vite config and `/api` dev proxy
- Create: `frontend/Dockerfile` - multi-stage frontend image build
- Create: `frontend/nginx.conf` - static hosting and `/api` proxy in production
- Create: `frontend/index.html` - Vite entry HTML
- Create: `frontend/src/main.tsx` - React bootstrap
- Create: `frontend/src/App.tsx` - top-level layout and orchestration
- Create: `frontend/src/types/chat.ts` - shared frontend types
- Create: `frontend/src/lib/api.ts` - REST client helpers
- Create: `frontend/src/lib/sse.ts` - `fetch`-based SSE parser for POST streams
- Create: `frontend/src/hooks/useChatSessions.ts` - session list and active session state
- Create: `frontend/src/hooks/useChatStream.ts` - streaming request lifecycle state
- Create: `frontend/src/components/Sidebar.tsx` - branding, new chat, session list shell
- Create: `frontend/src/components/SessionList.tsx` - session list rows and delete actions
- Create: `frontend/src/components/ChatPane.tsx` - message area and composer shell
- Create: `frontend/src/components/MessageList.tsx` - transcript rendering
- Create: `frontend/src/components/Composer.tsx` - input box and send button
- Create: `frontend/src/styles/tokens.css` - Stitch-derived design tokens
- Create: `frontend/src/styles/app.css` - app layout and component styling
- Create: `frontend/src/test/setup.ts` - Vitest/RTL setup
- Create: `frontend/src/components/Sidebar.test.tsx` - sidebar interaction tests
- Create: `frontend/src/components/ChatPane.test.tsx` - streaming UI tests
- Create: `frontend/src/App.test.tsx` - smoke/integration test for empty state and session load

### Notes That Affect Buildability

- Use `fetch` + `ReadableStream` parsing for chat streaming; do not use browser `EventSource` because the API shape is `POST /api/sessions/{session_id}/messages/stream`.
- Default `QWEN_BASE_URL` to `https://dashscope.aliyuncs.com/compatible-mode/v1` and keep it overrideable in `.env`.
- Keep session title generation deterministic in the backend; do not add model-generated titles.
- Persist assistant messages only after the model stream completes successfully.

### Task 1: Backend Foundation and Database Schema

**Files:**
- Create: `.gitignore`
- Create: `backend/pyproject.toml`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/20260321_01_create_chat_tables.py`
- Create: `backend/app/main.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/db/session.py`
- Create: `backend/app/db/models.py`
- Create: `backend/app/services/transcript_service.py`
- Create: `backend/tests/conftest.py`
- Test: `backend/tests/services/test_transcript_service.py`

- [ ] **Step 1: Write the failing transcript-order test**

```python
def test_messages_are_sorted_by_sequence():
    messages = [
        {"role": "assistant", "content": "second", "sequence": 2},
        {"role": "user", "content": "first", "sequence": 1},
    ]

    ordered = build_transcript(messages)

    assert ordered == [
        {"role": "user", "content": "first"},
        {"role": "assistant", "content": "second"},
    ]
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `cd backend && python -m pytest tests/services/test_transcript_service.py::test_messages_are_sorted_by_sequence -v`
Expected: FAIL with import or symbol errors because the backend package and transcript service do not exist yet.

- [ ] **Step 3: Add the backend skeleton and initial schema**

Create the app package, settings, SQLAlchemy session factory, ORM models, Alembic wiring, and the initial migration for `chat_sessions` and `chat_messages`.

```python
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    title = mapped_column(Text, nullable=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

- [ ] **Step 4: Implement the minimal transcript builder and rerun the test**

Run: `cd backend && python -m pytest tests/services/test_transcript_service.py::test_messages_are_sorted_by_sequence -v`
Expected: PASS

- [ ] **Step 5: Run the initial backend verification set**

Run: `cd backend && python -m pytest tests/services/test_transcript_service.py -v`
Expected: PASS with the transcript service suite green.

- [ ] **Step 6: Commit the foundation work**

```bash
git add .gitignore backend
git commit -m "feat: scaffold backend foundation"
```

### Task 2: Session Repositories and Session API

**Files:**
- Create: `backend/app/repositories/sessions.py`
- Create: `backend/app/repositories/messages.py`
- Create: `backend/app/schemas/session.py`
- Create: `backend/app/api/routes/sessions.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/api/test_sessions.py`

- [ ] **Step 1: Write the failing session API tests**

```python
def test_create_and_list_sessions(client):
    created = client.post("/api/sessions")
    listed = client.get("/api/sessions")

    assert created.status_code == 200
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == created.json()["id"]


def test_get_session_returns_messages(client, seeded_session):
    response = client.get(f"/api/sessions/{seeded_session.id}")

    assert response.status_code == 200
    assert response.json()["session"]["id"] == str(seeded_session.id)
    assert len(response.json()["messages"]) == 1


def test_delete_session_removes_messages(client, seeded_session):
    response = client.delete(f"/api/sessions/{seeded_session.id}")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
```

- [ ] **Step 2: Run the session API tests to verify they fail**

Run: `cd backend && python -m pytest tests/api/test_sessions.py -v`
Expected: FAIL because the repositories and `/api/sessions` routes are not implemented.

- [ ] **Step 3: Implement repositories and session routes**

Wire create/list/get/delete operations through repository helpers and Pydantic response models.

```python
@router.post("", response_model=SessionSummary)
def create_session(db: Session = Depends(get_db)) -> SessionSummary:
    session = create_chat_session(db)
    return SessionSummary.model_validate(session)
```

- [ ] **Step 4: Rerun the targeted session suite**

Run: `cd backend && python -m pytest tests/api/test_sessions.py -v`
Expected: PASS

- [ ] **Step 5: Run the backend API suite**

Run: `cd backend && python -m pytest tests/api/test_sessions.py tests/services/test_transcript_service.py -v`
Expected: PASS with session CRUD and transcript tests green.

- [ ] **Step 6: Commit the session API work**

```bash
git add backend
git commit -m "feat: add session management api"
```

### Task 3: Title Generation and Transcript Assembly Rules

**Files:**
- Create: `backend/app/services/title_service.py`
- Modify: `backend/app/services/transcript_service.py`
- Create: `backend/tests/services/test_title_service.py`
- Modify: `backend/tests/services/test_transcript_service.py`

- [ ] **Step 1: Write the failing title-generation tests**

```python
def test_title_uses_trimmed_first_message():
    assert make_session_title("   Hello   world from user   ") == "Hello world from user"


def test_title_truncates_long_messages():
    title = make_session_title("a" * 80)

    assert len(title) <= 30
```

- [ ] **Step 2: Run the title and transcript service tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_title_service.py tests/services/test_transcript_service.py -v`
Expected: FAIL because the title service and final transcript rules are not fully implemented.

- [ ] **Step 3: Implement deterministic title generation and transcript shaping**

Keep titles whitespace-normalized and keep transcript payloads limited to `role`/`content` pairs.

```python
def make_session_title(message: str, max_length: int = 30) -> str:
    normalized = " ".join(message.split())
    return normalized[:max_length]
```

- [ ] **Step 4: Rerun the service-level tests**

Run: `cd backend && python -m pytest tests/services/test_title_service.py tests/services/test_transcript_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit the service-layer rules**

```bash
git add backend
git commit -m "feat: add chat title and transcript services"
```

### Task 4: Qwen Client and Streaming Chat Endpoint

**Files:**
- Create: `backend/app/schemas/chat.py`
- Create: `backend/app/services/qwen_client.py`
- Create: `backend/app/services/sse.py`
- Create: `backend/app/services/chat_service.py`
- Create: `backend/app/api/routes/chat.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/conftest.py`
- Create: `backend/tests/api/test_chat_stream.py`

- [ ] **Step 1: Write the failing streaming endpoint tests**

```python
def test_stream_chat_emits_start_delta_done(client, fake_qwen_stream, seeded_session):
    response = client.post(
        f"/api/sessions/{seeded_session.id}/messages/stream",
        json={"message": "Hello"},
    )

    body = response.text

    assert "event: start" in body
    assert 'event: delta' in body
    assert 'event: done' in body


def test_failed_stream_does_not_persist_partial_assistant(client, fake_failing_qwen_stream, seeded_session, db_session):
    response = client.post(
        f"/api/sessions/{seeded_session.id}/messages/stream",
        json={"message": "Hello"},
    )

    assert "event: error" in response.text
    assert count_assistant_messages(db_session, seeded_session.id) == 0
```

- [ ] **Step 2: Run the streaming tests to verify they fail**

Run: `cd backend && python -m pytest tests/api/test_chat_stream.py -v`
Expected: FAIL because the Qwen client, SSE formatter, and chat route are not implemented.

- [ ] **Step 3: Implement the Qwen client abstraction and chat orchestration**

Use `AsyncOpenAI` against DashScope compatible mode and keep the API surface injectable for tests.

```python
async for chunk in client.chat.completions.create(
    model=settings.qwen_model,
    messages=transcript,
    stream=True,
):
    delta = chunk.choices[0].delta.content or ""
    if delta:
        yield delta
```

- [ ] **Step 4: Implement the route-level SSE response**

Format events as `text/event-stream` and emit `start`, `delta`, `done`, or `error`.

```python
return StreamingResponse(
    event_generator(),
    media_type="text/event-stream",
    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
)
```

- [ ] **Step 5: Rerun the streaming tests**

Run: `cd backend && python -m pytest tests/api/test_chat_stream.py -v`
Expected: PASS

- [ ] **Step 6: Run the complete backend test suite**

Run: `cd backend && python -m pytest tests -v`
Expected: PASS with session, transcript, title, and streaming coverage green.

- [ ] **Step 7: Commit the streaming backend**

```bash
git add backend
git commit -m "feat: add streaming chat backend"
```

### Task 5: Frontend Foundation, Layout Shell, and API Client

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/ChatPane.tsx`
- Create: `frontend/src/types/chat.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/app.css`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write the failing app-shell test**

```tsx
it("renders the empty chat shell", async () => {
  render(<App />);

  expect(await screen.findByText(/new chat/i)).toBeInTheDocument();
  expect(screen.getByText(/start a conversation/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the app-shell test to verify it fails**

Run: `cd frontend && npm run test -- src/App.test.tsx`
Expected: FAIL because the Vite app, CSS, and `App` component do not exist yet.

- [ ] **Step 3: Scaffold the React app and API client**

Create the Vite app files, shared types, a small REST client, and the initial empty-state layout that mirrors the Stitch structure.

```tsx
export function App() {
  return (
    <div className="app-shell">
      <Sidebar />
      <ChatPane emptyStateTitle="Start a conversation" />
    </div>
  );
}
```

- [ ] **Step 4: Rerun the app-shell test**

Run: `cd frontend && npm run test -- src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the frontend smoke checks**

Run: `cd frontend && npm run test -- src/App.test.tsx && npm run build`
Expected: test PASS and Vite production build succeeds.

- [ ] **Step 6: Commit the frontend foundation**

```bash
git add frontend
git commit -m "feat: scaffold frontend shell"
```

### Task 6: Session Sidebar, Load Flow, and Delete Flow

**Files:**
- Create: `frontend/src/hooks/useChatSessions.ts`
- Modify: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/SessionList.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/components/Sidebar.test.tsx`

- [ ] **Step 1: Write the failing sidebar interaction tests**

```tsx
it("loads sessions and selects the newest session", async () => {
  render(<App />);

  expect(await screen.findByText("Most recent chat")).toBeInTheDocument();
});

it("deletes the active session and falls back to empty state", async () => {
  render(<App />);

  await user.click(await screen.findByRole("button", { name: /delete session/i }));

  expect(await screen.findByText(/start a conversation/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the sidebar tests to verify they fail**

Run: `cd frontend && npm run test -- src/components/Sidebar.test.tsx`
Expected: FAIL because session state hooks and sidebar behavior are not implemented.

- [ ] **Step 3: Implement session-state loading and sidebar components**

Keep the state model minimal: list sessions, create session, load session details, delete session, and track the active session id.

```tsx
const { sessions, activeSessionId, createSession, deleteSession, selectSession } =
  useChatSessions(apiClient);
```

- [ ] **Step 4: Rerun the sidebar tests**

Run: `cd frontend && npm run test -- src/components/Sidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the current frontend suite**

Run: `cd frontend && npm run test -- src/App.test.tsx src/components/Sidebar.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit the sidebar and session flows**

```bash
git add frontend
git commit -m "feat: add session sidebar flows"
```

### Task 7: Chat Transcript, Composer, and POST-SSE Stream Parsing

**Files:**
- Create: `frontend/src/lib/sse.ts`
- Create: `frontend/src/hooks/useChatStream.ts`
- Modify: `frontend/src/components/ChatPane.tsx`
- Create: `frontend/src/components/MessageList.tsx`
- Create: `frontend/src/components/Composer.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/components/ChatPane.test.tsx`

- [ ] **Step 1: Write the failing streaming UI tests**

```tsx
it("appends streamed assistant text into a single bubble", async () => {
  render(<App />);

  await user.type(screen.getByPlaceholderText(/send a message/i), "Hello");
  await user.click(screen.getByRole("button", { name: /send/i }));

  expect(await screen.findByText("Hello")).toBeInTheDocument();
  expect(await screen.findByText("Hi there")).toBeInTheDocument();
});

it("marks the assistant bubble as failed when the stream errors", async () => {
  render(<App />);

  await user.type(screen.getByPlaceholderText(/send a message/i), "Hello");
  await user.click(screen.getByRole("button", { name: /send/i }));

  expect(await screen.findByText(/generation failed/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the chat-pane tests to verify they fail**

Run: `cd frontend && npm run test -- src/components/ChatPane.test.tsx`
Expected: FAIL because the composer, message list, and stream parser do not exist.

- [ ] **Step 3: Implement the POST-SSE parser and streaming hook**

Parse chunks from `fetch` manually and hand normalized events to the hook.

```ts
for await (const event of parseSseStream(response.body)) {
  if (event.event === "delta") {
    onDelta(event.data.text);
  }
}
```

- [ ] **Step 4: Implement transcript rendering and composer wiring**

Insert the optimistic user message, create a single in-flight assistant bubble, append deltas into it, and finalize it on `done`.

```tsx
setMessages((current) => [
  ...current,
  { id: tempUserId, role: "user", content: input },
  { id: tempAssistantId, role: "assistant", content: "", status: "streaming" },
]);
```

- [ ] **Step 5: Rerun the chat-pane tests**

Run: `cd frontend && npm run test -- src/components/ChatPane.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full frontend suite**

Run: `cd frontend && npm run test && npm run build`
Expected: PASS with all component tests green and a successful production build.

- [ ] **Step 7: Commit the streaming frontend**

```bash
git add frontend
git commit -m "feat: add streaming chat ui"
```

### Task 8: Docker, Environment Wiring, and Deployment Documentation

**Files:**
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `README.md`
- Create: `deploy/tencent-cloud.md`

- [ ] **Step 1: Write the failing deployment verification checklist into the docs**

Document the commands that must work once containerization is complete:

```text
docker compose up --build
curl http://localhost/api/sessions
```

Treat missing files and broken builds as the initial failure condition for this task.

- [ ] **Step 2: Run the container build command to verify it fails before Docker files exist**

Run: `docker compose build`
Expected: FAIL because `docker-compose.yml` and Dockerfiles do not exist yet.

- [ ] **Step 3: Add Dockerfiles, Compose wiring, and env templates**

Use one Compose stack with:
- `postgres` volume-backed persistence
- `backend` running FastAPI
- `frontend` serving the built app and proxying `/api` to `backend`

```yaml
services:
  postgres:
    image: postgres:16-alpine
  backend:
    build: ./backend
  frontend:
    build: ./frontend
    ports:
      - "80:80"
```

- [ ] **Step 4: Add local and server deployment docs**

Cover:
- `.env` creation from `.env.example`
- local `docker compose up --build`
- Tencent Cloud server login, code pull, env file setup, and detached compose start
- note that secrets must stay out of git

- [ ] **Step 5: Run the deployment verification commands**

Run: `docker compose build && docker compose config`
Expected: PASS with a valid Compose configuration and successful image builds.

- [ ] **Step 6: Commit the deployment layer**

```bash
git add .gitignore .env.example docker-compose.yml backend/Dockerfile frontend/Dockerfile frontend/nginx.conf README.md deploy/tencent-cloud.md
git commit -m "feat: add containerized deployment"
```

### Task 9: Final Integrated Verification

**Files:**
- Modify: `README.md`
- Modify: `deploy/tencent-cloud.md`

- [ ] **Step 1: Run the backend test suite**

Run: `cd backend && python -m pytest tests -v`
Expected: PASS

- [ ] **Step 2: Run the frontend test suite and production build**

Run: `cd frontend && npm run test && npm run build`
Expected: PASS

- [ ] **Step 3: Run the full stack locally**

Run: `docker compose up --build -d && docker compose ps`
Expected: frontend, backend, and postgres containers start successfully and show `running` or healthy status.

- [ ] **Step 4: Perform the manual acceptance path**

Verify the following in the browser:
1. Create a new session
2. Send the first message and watch the assistant stream in
3. Refresh the page and confirm the conversation still appears
4. Open the same historical session and continue chatting with preserved context
5. Delete a session and confirm the UI falls back correctly

- [ ] **Step 5: Record any environment-specific notes in the docs**

Update `README.md` or `deploy/tencent-cloud.md` only if the verification uncovered a real operational requirement.

- [ ] **Step 6: Commit final verification notes**

```bash
git status --short
# If README.md or deploy/tencent-cloud.md changed:
git add README.md deploy/tencent-cloud.md
git commit -m "docs: finalize verification notes"
```
