import type { InterviewMode, KnowledgeDocKind } from "@careercenter/shared";

export interface InterviewKnowledgeDoc {
  id: string;
  userId: string;
  kind: KnowledgeDocKind;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewSession {
  id: string;
  userId: string;
  mode: InterviewMode;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewMessage {
  id: string;
  sessionId: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface InterviewPrepRepository {
  listKnowledgeDocs(userId: string): Promise<InterviewKnowledgeDoc[]>;
}
