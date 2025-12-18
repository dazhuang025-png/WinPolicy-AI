export interface DecodingItem {
  surface: string;
  deep: string;
}

export interface Emotions {
  start: string;
  middle: string;
  end: string;
  turningPoint: string;
}

export interface Advice {
  script: string;
  materials: string;
  timing: string;
}

export interface TrustMetrics {
  score: number; // 0-100
  probability: 'Low' | 'Medium' | 'High';
  resistance: 'Red' | 'Yellow' | 'Green';
}

export interface AnalysisResult {
  trust: TrustMetrics;
  decoding: DecodingItem[];
  emotions: Emotions;
  advice: Advice;
}

export interface ChatMessage {
  role: 'user' | 'neo';
  content: string;
  id: string;
}

export enum LoadingState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}