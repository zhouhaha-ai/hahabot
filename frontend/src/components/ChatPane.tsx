import type { ChatMessage } from "../types/chat";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";

type ChatPaneProps = {
  sessionTitle: string | null;
  messages: ChatMessage[];
  canSendMessage: boolean;
  isStreaming: boolean;
  onSendMessage: (message: string) => Promise<void>;
};

export function ChatPane({
  canSendMessage,
  isStreaming,
  sessionTitle,
  messages,
  onSendMessage,
}: ChatPaneProps) {
  const isEmpty = messages.length === 0;

  return (
    <main className="chat-pane">
      {isEmpty ? (
        <section className="chat-pane__empty-state">
          <div className="chat-pane__hero-mark" aria-hidden="true">
            <span>☺</span>
          </div>
          <div className="chat-pane__hero-copy">
            <h2>今天我能帮你做些什么？</h2>
            <p>您的智能助手，随时准备为您提供写作、代码或头脑风暴方面的帮助。</p>
          </div>
          <div className="chat-pane__suggestions" aria-label="Suggested prompts">
            {SUGGESTIONS.map((suggestion) => (
              <button className="chat-pane__suggestion" key={suggestion.title} type="button">
                <span className="chat-pane__suggestion-icon" aria-hidden="true">
                  {suggestion.icon}
                </span>
                <span className="chat-pane__suggestion-title">{suggestion.title}</span>
                <span className="chat-pane__suggestion-description">{suggestion.description}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="chat-pane__messages">
          <header className="chat-pane__header">
            <div>
              <span className="chat-pane__eyebrow">当前会话</span>
              <h2>{sessionTitle ?? "未命名对话"}</h2>
            </div>
            <span className="chat-pane__status">{isStreaming ? "生成中" : "在线"}</span>
          </header>
          <MessageList messages={messages} />
        </section>
      )}

      <div className="chat-pane__composer-wrap">
        <Composer
          disabled={!canSendMessage}
          isStreaming={isStreaming}
          onSend={onSendMessage}
        />
        <p className="chat-pane__composer-note">哈哈机器人可能会出错。请核实重要信息。</p>
      </div>
    </main>
  );
}

const SUGGESTIONS = [
  {
    icon: "文",
    title: "总结文本",
    description: "快速提炼长文重点和行动项。",
  },
  {
    icon: "故",
    title: "写个故事",
    description: "生成更完整的人物和情节走向。",
  },
  {
    icon: "</>",
    title: "调试代码",
    description: "定位错误并优化你的实现逻辑。",
  },
  {
    icon: "灵",
    title: "头脑风暴",
    description: "为你的下一个项目提供新角度。",
  },
] as const;
