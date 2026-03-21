export type SessionSummary = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sequence: number;
  createdAt: string;
  status?: "complete" | "streaming" | "failed";
  errorMessage?: string;
};

export type SessionDetail = {
  session: SessionSummary;
  messages: ChatMessage[];
};
