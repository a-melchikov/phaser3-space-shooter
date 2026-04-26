import type { AuthActionResult, AuthStateListener, UserSession } from "./types";
import { createGuestSession } from "./types";
import type { AuthService } from "./AuthService";
import { AuthState } from "./authState";
import { isFirebaseAuthConfigured } from "./firebaseConfig";

export class LazyFirebaseAuthService implements AuthService {
  private readonly googleLoginAvailable = isFirebaseAuthConfigured();
  private delegate?: AuthService;
  private delegatePromise?: Promise<AuthService>;

  public constructor(private readonly authState: AuthState) {}

  public async initialize(): Promise<void> {
    if (!this.googleLoginAvailable) {
      this.authState.setSession(createGuestSession());
      return;
    }

    const delegate = await this.loadDelegate();
    await delegate.initialize();
  }

  public getSession(): UserSession {
    return this.delegate?.getSession() ?? this.authState.getSnapshot();
  }

  public async getIdToken(): Promise<string | null> {
    if (!this.googleLoginAvailable) {
      return null;
    }

    const delegate = await this.loadDelegate();
    return delegate.getIdToken();
  }

  public subscribe(listener: AuthStateListener): () => void {
    return this.authState.subscribe(listener);
  }

  public async signInAsGuest(): Promise<AuthActionResult> {
    if (!this.googleLoginAvailable) {
      const session = createGuestSession();
      this.authState.setSession(session);

      return {
        ok: true,
        session
      };
    }

    const delegate = await this.loadDelegate();
    return delegate.signInAsGuest();
  }

  public async signInWithGoogle(): Promise<AuthActionResult> {
    if (!this.googleLoginAvailable) {
      const session = this.getSession();

      return {
        ok: false,
        session,
        errorCode: "auth/google-unavailable",
        errorMessage: "Вход через Google недоступен в этой сборке."
      };
    }

    const delegate = await this.loadDelegate();
    return delegate.signInWithGoogle();
  }

  public async signOut(): Promise<AuthActionResult> {
    if (!this.googleLoginAvailable) {
      const session = createGuestSession();
      this.authState.setSession(session);

      return {
        ok: true,
        session
      };
    }

    const delegate = await this.loadDelegate();
    return delegate.signOut();
  }

  public isGoogleLoginAvailable(): boolean {
    return this.googleLoginAvailable;
  }

  public destroy(): void {
    this.delegate?.destroy();
    this.delegate = undefined;
    this.delegatePromise = undefined;
  }

  private loadDelegate(): Promise<AuthService> {
    if (this.delegate) {
      return Promise.resolve(this.delegate);
    }

    if (!this.delegatePromise) {
      this.delegatePromise = import("./FirebaseAuthService").then(({ FirebaseAuthService }) => {
        const delegate = new FirebaseAuthService(this.authState);
        this.delegate = delegate;
        return delegate;
      });
    }

    return this.delegatePromise;
  }
}
