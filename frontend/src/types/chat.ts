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
};

export type SessionDetail = {
  session: SessionSummary;
  messages: ChatMessage[];
};
