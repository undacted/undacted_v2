export enum AppStep {
  UPLOAD = 'UPLOAD',
  ANALYSIS_SETUP = 'ANALYSIS_SETUP',
  ANALYSIS_RUNNING = 'ANALYSIS_RUNNING',
  REVIEW = 'REVIEW',
  FINAL = 'FINAL'
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AnalysisData {
  redactionRect: Rect | null;
  referenceRect: Rect | null;
  referenceText: string;
  imageWidth: number;
  imageHeight: number;
  estimatedHiddenChars: number;
  lazyRedactionDetected: boolean;
  matchedProfiles: Profile[];
  finalImageUrl: string | null;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  clearance: string;
}

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: number;
  isTyping?: boolean;
}
