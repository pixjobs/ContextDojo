export interface MindMapNode {
  id: string;
  label: string;
  group: number; 
  type: 'root' | 'concept' | 'entity' | 'action' | 'emotion';
  status: 'active' | 'potential';
}

export interface MindMapLink {
  source: string;
  target: string;
}

export type ConversationMode = 'topical' | 'social' | 'debate' | 'adaptive' | null;

export interface DojoState {
  mode: ConversationMode;
  currentTopic: string;
  mindMapNodes: MindMapNode[];
  mindMapLinks: MindMapLink[];
  conversationHistory: ChatMessage[];
  lastGuidance: string | null;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  translatedText?: string; 
  timestamp: Date;
}

export interface BrainResponse {
  reply_text?: string; 
  english_user_translation: string;
  english_agent_translation: string;
  coach_guidance: string | null;
  key_concept: string | null; 
}

export interface GraphUpdate {
  nodes: { 
    label: string; 
    type: 'concept' | 'entity' | 'action' | 'emotion';
    status: 'active' | 'potential';
    parent: string;
  }[];
}