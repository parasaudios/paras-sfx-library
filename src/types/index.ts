// Centralized type definitions for the entire application

export interface Sound {
  id: string;
  title: string;
  audioUrl: string;
  tags: string[];
  equipment?: string;
  format?: string;
}

export interface Suggestion {
  id: string;
  soundName: string;
  category: string;
  description: string;
  submittedAt: string;
  isRead: boolean;
}
