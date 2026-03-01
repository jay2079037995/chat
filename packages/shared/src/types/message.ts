export type MessageType = 'text' | 'image' | 'audio' | 'code' | 'markdown' | 'file';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  codeLanguage?: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  type: 'private' | 'group';
  participants: string[];
  lastMessage?: Message;
  updatedAt: number;
}
