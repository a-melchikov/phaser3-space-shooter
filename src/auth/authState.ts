import { createGuestSession, type AuthStateListener, type UserSession } from "./types";

export class AuthState {
  private currentSession: UserSession = createGuestSession();
  private readonly listeners = new Set<AuthStateListener>();

  public getSnapshot(): UserSession {
    return this.currentSession;
  }

  public setSession(session: UserSession): void {
    if (areSessionsEqual(this.currentSession, session)) {
      return;
    }

    this.currentSession = session;
    this.listeners.forEach((listener) => listener(this.currentSession));
  }

  public subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSession);

    return () => {
      this.listeners.delete(listener);
    };
  }
}

function areSessionsEqual(left: UserSession, right: UserSession): boolean {
  return left.mode === right.mode
    && left.provider === right.provider
    && left.isAuthenticated === right.isAuthenticated
    && left.isGuest === right.isGuest
    && left.displayName === right.displayName
    && left.email === right.email
    && left.avatarUrl === right.avatarUrl
    && left.localGuest === right.localGuest
    && left.rankedEligible === right.rankedEligible
    && left.user?.id === right.user?.id
    && left.user?.displayName === right.user?.displayName
    && left.user?.email === right.user?.email
    && left.user?.avatarUrl === right.user?.avatarUrl
    && left.user?.provider === right.user?.provider;
}
