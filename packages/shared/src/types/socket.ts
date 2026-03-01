import type { Message } from './message';

export interface ServerToClientEvents {
  'message:receive': (message: Message) => void;
  'user:online': (userId: string) => void;
  'user:offline': (userId: string) => void;
  'message:read': (data: { conversationId: string; userId: string }) => void;
}

export interface ClientToServerEvents {
  'message:send': (data: { conversationId: string; type: Message['type']; content: string; fileName?: string; fileSize?: number; mimeType?: string; codeLanguage?: string }, callback: (message: Message) => void) => void;
  'message:read': (data: { conversationId: string }) => void;
  'conversation:join': (conversationId: string) => void;
}
