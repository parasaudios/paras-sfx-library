// Centralized type definitions for the entire application

export interface Sound {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  audioUrl: string;
  downloadUrl: string;
  mp3_path: string | null;
  wav_path: string | null;
  has_wav: boolean;
  file_size: number | null;
  duration_seconds: number | null;
  channels: number | null;
  microphone: string | null;
  recorder: string | null;
  format: string | null;
  filename: string | null;
  category: string | null;
  nsfw: boolean;
  listens: number;
  downloads: number;
  source: string | null;
  created_at: string;
  updated_at: string;
  mp3_sample_rate: number | null;
  mp3_bit_depth: number | null;
  wav_sample_rate: number | null;
  wav_bit_depth: number | null;
}

export interface Suggestion {
  id: string;
  soundName: string;
  category: string;
  description: string;
  submittedAt: string;
  isRead: boolean;
  status: string;
}
