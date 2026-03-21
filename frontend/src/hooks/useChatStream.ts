import { useState } from "react";

import type { ChatApiClient } from "../lib/api";
import { parseSseStream } from "../lib/sse";

type StreamCallbacks = {
  onDelta: (text: string) => void;
  onDone: (messageId: string) => void;
  onError: (error: string) => void;
};

type SendMessageArgs = {
  message: string;
  sessionId: string;
} & StreamCallbacks;

export function useChatStream(apiClient: ChatApiClient) {
  const [isStreaming, setIsStreaming] = useState(false);

  async function sendMessage({
    message,
    onDelta,
    onDone,
    onError,
    sessionId,
  }: SendMessageArgs) {
    setIsStreaming(true);

    try {
      const response = await apiClient.streamMessage(sessionId, message);

      if (!response.ok) {
        throw new Error(`Stream request failed with status ${response.status}`);
      }

      if (response.body === null) {
        throw new Error("Stream response body is missing");
      }

      for await (const event of parseSseStream(response.body)) {
        if (event.event === "delta") {
          onDelta((event.data as { text: string }).text);
        }

        if (event.event === "done") {
          onDone((event.data as { message_id: string }).message_id);
        }

        if (event.event === "error") {
          onError((event.data as { error: string }).error);
          return;
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unknown streaming error");
    } finally {
      setIsStreaming(false);
    }
  }

  return {
    isStreaming,
    sendMessage,
  };
}
