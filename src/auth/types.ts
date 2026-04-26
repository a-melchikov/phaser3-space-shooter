export type AuthMode = "guest" | "google";
export type AuthProvider = AuthMode;

export interface AuthUser {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  provider: "google";
}

export interface UserSession {
  mode: AuthMode;
  provider: AuthProvider;
  isAuthenticated: boolean;
  isGuest: boolean;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  user: AuthUser | null;
  localGuest: boolean;
  rankedEligible: boolean;
}

export interface AuthActionResult {
  ok: boolean;
  session: UserSession;
  errorMessage?: string;
  errorCode?: string;
}

export type AuthStateListener = (session: UserSession) => void;

export function createGuestSession(displayName = "Гость"): UserSession {
  return {
    mode: "guest",
    provider: "guest",
    isAuthenticated: false,
    isGuest: true,
    displayName,
    email: null,
    avatarUrl: null,
    user: null,
    localGuest: true,
    rankedEligible: false
  };
}

export function createAuthenticatedSession(user: AuthUser): UserSession {
  return {
    mode: "google",
    provider: "google",
    isAuthenticated: true,
    isGuest: false,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    user,
    localGuest: false,
    rankedEligible: true
  };
}
