export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string;
  bio: string;
}

export interface PublicProfile {
  id: string;
  username: string;
  avatar_url: string;
  bio: string;
  games_count: number;
  completed_count: number;
  hours_played: number;
  avg_rating: number;
}

export interface Game {
  id: string;
  title: string;
  slug: string;
  description: string;
  developer: string;
  publisher: string;
  release_date?: string;
  cover_url?: string;
}

export interface PaginatedGames {
  games: Game[];
  total: number;
  page: number;
  limit: number;
}

export interface Platform {
  id: string;
  name: string;
  slug: string;
  manufacturer: string;
  generation: number;
}

export interface Release {
  id: string;
  game_id: string;
  platform_id: string;
  platform_name?: string;
  region: string;
  release_date?: string;
  edition: string;
  physical: boolean;
  official: boolean;
}

export interface Cover {
  id: string;
  game_id: string;
  release_id?: string;
  url: string;
  region: string;
  language: string;
  type: string;
  width: number;
  height: number;
  source: string;
  primary: boolean;
}

export interface GameDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  developer: string;
  publisher: string;
  release_date?: string;
  platforms: Platform[];
  releases: Release[];
  covers: Cover[];
  avg_rating: number;
  reviews_count: number;
}

export interface Review {
  id: string;
  user_id: string;
  game_id: string;
  rating: number;
  title: string;
  content: string;
  spoiler: boolean;
  created_at: string;
  updated_at: string;
  username?: string;
  avatar_url?: string;
  likes_count: number;
}

export interface PaginatedReviews {
  reviews: Review[];
  total: number;
  page: number;
  limit: number;
}

export interface Comment {
  id: string;
  user_id: string;
  review_id: string;
  content: string;
  created_at: string;
  username?: string;
  avatar_url?: string;
}

export interface Library {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_public: boolean;
  games_count: number;
  created_at: string;
}

export interface LibraryGame {
  game_id: string;
  release_id?: string;
  title?: string;
  platform?: string;
  cover_url?: string;
  status: string;
  progress: number;
  hours_played: number;
  added_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface LibraryDetail extends Library {
  games: LibraryGame[];
}

export interface Progress {
  game_id: string;
  status: string;
  progress: number;
  hours_played: number;
  started_at?: string;
  completed_at?: string;
}

export interface FeedItem {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string;
  type: string;
  entity_id: string;
  title?: string;
  created_at: string;
}

export interface MatchResult {
  game_id: string;
  release_id?: string;
  title: string;
  platform: string;
  region: string;
  cover_url: string;
  similarity: number;
}

export interface ScanResponse {
  matches: MatchResult[];
  method: string;
  /** How the returned match was obtained, when the scanner used a fallback. */
  match_source?: 'visual' | 'catalog';
}

export interface CoverAnalysis {
  title: string;
  console: string;
  region: string;
  edition: string;
  publisher: string;
  query: string;
}

export interface SearchItem {
  game_id: string;
  title: string;
  system?: string;
  system_id?: number;
  region?: string;
  release_date?: string;
  cover_url?: string;
  synopsis?: string;
  note?: string;
  official: boolean;
  filtered_out?: boolean;
}

export interface ScreenScraperDetail {
  game_id: string;
  title: string;
  description: string;
  developer: string;
  publisher: string;
  release_date?: string;
  players?: string;
  note?: string;
  system?: string;
  system_id?: number;
  official: boolean;
  filtered_out?: boolean;
  cover_url?: string;
  covers?: { key: string; url: string; kind?: string; region?: string }[];
  media?: { key: string; url: string; kind?: string; region?: string }[];
}

export interface ImportResponse {
  game_id: string;
  title: string;
  created: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}
