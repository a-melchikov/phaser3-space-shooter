import type { Auth, User as FirebaseUser, Unsubscribe } from "firebase/auth";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut as firebaseSignOut
} from "firebase/auth";

import type { AuthService } from "./AuthService";
import { AuthState } from "./authState";
import { getFirebaseApp, isFirebaseAuthConfigured } from "./firebase";
import {
  createAuthenticatedSession,
  createGuestSession,
  type AuthActionResult,
  type AuthUser,
  type AuthStateListener,
  type UserSession
} from "./types";

export class FirebaseAuthService implements AuthService {
  private readonly googleLoginAvailable = isFirebaseAuthConfigured();
  private readonly app = getFirebaseApp();
  private auth?: Auth;
  private authUnsubscribe?: Unsubscribe;
  private initializationPromise?: Promise<void>;

  public constructor(private readonly authState: AuthState) {}

  public async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (!this.googleLoginAvailable || !this.app) {
      this.authState.setSession(createGuestSession());
      this.initializationPromise = Promise.resolve();
      return this.initializationPromise;
    }

    this.auth = getAuth(this.app);

    this.initializationPromise = setPersistence(this.auth, browserLocalPersistence)
      .catch(() => {
        // Persistence fallback should not block guest mode or Google sign-in flow.
      })
      .then(
        () =>
          new Promise<void>((resolve) => {
            let resolved = false;

            this.authUnsubscribe = onAuthStateChanged(
              this.auth as Auth,
              (user) => {
                this.authState.setSession(user ? this.toAuthenticatedSession(user) : createGuestSession());

                if (!resolved) {
                  resolved = true;
                  resolve();
                }
              },
              () => {
                this.authState.setSession(createGuestSession());

                if (!resolved) {
                  resolved = true;
                  resolve();
                }
              }
            );
          })
      );

    return this.initializationPromise;
  }

  public getSession(): UserSession {
    return this.authState.getSnapshot();
  }

  public async getIdToken(): Promise<string | null> {
    await this.initialize();

    const currentUser = this.auth?.currentUser;

    if (!currentUser) {
      return null;
    }

    try {
      return await currentUser.getIdToken();
    } catch {
      return null;
    }
  }

  public subscribe(listener: AuthStateListener): () => void {
    return this.authState.subscribe(listener);
  }

  public async signInAsGuest(): Promise<AuthActionResult> {
    await this.initialize();

    try {
      if (this.auth?.currentUser) {
        await firebaseSignOut(this.auth);
      }
    } catch {
      const session = this.getSession();
      return {
        ok: false,
        session,
        errorMessage: "Не удалось выйти из Google-профиля перед переходом в гостевой режим."
      };
    }

    const session = createGuestSession();
    this.authState.setSession(session);

    return {
      ok: true,
      session
    };
  }

  public async signInWithGoogle(): Promise<AuthActionResult> {
    await this.initialize();

    if (!this.googleLoginAvailable || !this.auth) {
      const session = this.getSession();
      return {
        ok: false,
        session,
        errorMessage: "Google login недоступен: настройте Firebase env-переменные."
      };
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const credential = await signInWithPopup(this.auth, provider);
      const session = this.toAuthenticatedSession(credential.user);
      this.authState.setSession(session);

      return {
        ok: true,
        session
      };
    } catch (error) {
      return {
        ok: false,
        session: this.getSession(),
        errorMessage: this.getReadableErrorMessage(error)
      };
    }
  }

  public async signOut(): Promise<AuthActionResult> {
    await this.initialize();

    try {
      if (this.auth?.currentUser) {
        await firebaseSignOut(this.auth);
      }
    } catch {
      const session = this.getSession();
      return {
        ok: false,
        session,
        errorMessage: "Не удалось завершить Google-сессию."
      };
    }

    const session = createGuestSession();
    this.authState.setSession(session);

    return {
      ok: true,
      session
    };
  }

  public isGoogleLoginAvailable(): boolean {
    return this.googleLoginAvailable;
  }

  public destroy(): void {
    this.authUnsubscribe?.();
    this.authUnsubscribe = undefined;
  }

  private toAuthenticatedSession(user: FirebaseUser): UserSession {
    const authUser: AuthUser = {
      id: user.uid,
      displayName: user.displayName || user.email || "Google player",
      email: user.email,
      avatarUrl: user.photoURL,
      provider: "google"
    };

    return createAuthenticatedSession(authUser);
  }

  private getReadableErrorMessage(error: unknown): string {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
    ) {
      switch (error.code) {
        case "auth/popup-closed-by-user":
          return "Окно Google login было закрыто до завершения входа.";
        case "auth/popup-blocked":
          return "Браузер заблокировал popup для Google login.";
        case "auth/cancelled-popup-request":
          return "Запрос на вход через Google был отменён.";
        case "auth/unauthorized-domain":
          return "Текущий домен не добавлен в список разрешённых доменов Firebase Authentication.";
        default:
          return "Не удалось выполнить вход через Google. Проверьте настройки Firebase Authentication.";
      }
    }

    return "Не удалось выполнить вход через Google.";
  }
}
