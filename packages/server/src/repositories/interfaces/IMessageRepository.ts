import type { Message, Conversation } from '@chat/shared';

export interface IMessageRepository {
  saveMessage(message: Message): Promise<Message>;
  getMessages(conversationId: string, offset: number, limit: number): Promise<Message[]>;
  searchMessages(conversationId: string, keyword: string): Promise<Message[]>;
  getConversation(id: string): Promise<Conversation | null>;
  getConversationsByUserId(userId: string): Promise<Conversation[]>;
  createConversation(conversation: Conversation): Promise<Conversation>;
  updateConversation(id: string, data: Partial<Conversation>): Promise<void>;
}
