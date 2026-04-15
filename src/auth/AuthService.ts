import type { AuthActionResult, AuthStateListener, UserSession } from "./types";

export interface AuthService {
  initialize(): Promise<void>;
  getSession(): UserSession;
  getIdToken(): Promise<string | null>;
  subscribe(listener: AuthStateListener): () => void;
  signInAsGuest(): Promise<AuthActionResult>;
  signInWithGoogle(): Promise<AuthActionResult>;
  signOut(): Promise<AuthActionResult>;
  isGoogleLoginAvailable(): boolean;
  destroy(): void;
}
