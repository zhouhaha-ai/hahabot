export type SseEvent = {
  event: string;
  data: unknown;
};

export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const block of events) {
      const parsed = parseSseBlock(block);
      if (parsed !== null) {
        yield parsed;
      }
    }

    if (done) {
      const trailing = parseSseBlock(buffer);
      if (trailing !== null) {
        yield trailing;
      }
      return;
    }
  }
}

function parseSseBlock(block: string): SseEvent | null {
  if (block.trim() === "") {
    return null;
  }

  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: JSON.parse(dataLines.join("\n")),
  };
}
