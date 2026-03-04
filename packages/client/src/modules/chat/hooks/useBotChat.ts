/**
 * Bot 聊天 Hook
 *
 * 基于 @ai-sdk/react 的 useChat，通过 HTTP SSE 实现流式 AI 聊天。
 * 仅用于 1:1 Bot 对话，自动管理消息发送/接收/流式显示。
 */
import { useChat } from '@ai-sdk/react';
import type { Message } from '@chat/shared';

/** Electron 打包后从本地文件加载，API 需指向服务端地址 */
const serverUrl = (window as any).electronAPI?.serverUrl || '';

interface UseBotChatOptions {
  botId: string;
  conversationId: string;
  initialMessages: Message[];
  currentUserId: string;
  enabled: boolean;
}

export function useBotChat({
  botId,
  conversationId,
  initialMessages,
  currentUserId,
  enabled,
}: UseBotChatOptions) {
  const chat = useChat({
    api: `${serverUrl}/api/bot/chat`,
    body: { conversationId, botId },
    headers: {
      'x-session-id': sessionStorage.getItem('sessionId') || '',
    },
    initialMessages: enabled
      ? initialMessages.map((m) => ({
          id: m.id,
          role: m.senderId === currentUserId ? ('user' as const) : ('assistant' as const),
          content: m.content,
        }))
      : [],
  });

  return chat;
}
