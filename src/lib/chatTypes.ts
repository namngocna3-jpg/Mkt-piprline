export type Attachment = {
  id: string;
  name: string;
  type: string;          // mime
  size?: number;
  extractedText?: string;
  preview?: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  position: number;
  createdAt?: string;
};

export type Conversation = {
  id: string;
  keyId: string;
  title: string;
  systemPrompt?: string | null;
  remoteId?: string | null;
  namespace?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ApiKey = {
  id: string;
  name: string;
  key: string;
  twinName?: string | null;
  description?: string | null;
  isActive: number;
};
