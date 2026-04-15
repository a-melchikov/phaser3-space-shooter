import { createGuestSession, type AuthStateListener, type UserSession } from "./types";

export class AuthState {
  private currentSession: UserSession = createGuestSession();
  private readonly listeners = new Set<AuthStateListener>();

  public getSnapshot(): UserSession {
    return this.currentSession;
  }

  public setSession(session: UserSession): void {
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
