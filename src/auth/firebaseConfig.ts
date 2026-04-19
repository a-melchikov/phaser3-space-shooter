export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
  measurementId?: string;
}

const REQUIRED_FIREBASE_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID"
] as const;

export function getFirebaseClientConfig(): FirebaseClientConfig | null {
  const hasRequiredConfig = REQUIRED_FIREBASE_KEYS.every((key) => {
    const value = import.meta.env[key];
    return typeof value === "string" && value.trim().length > 0;
  });

  if (!hasRequiredConfig) {
    return null;
  }

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string;

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined
  };
}

export function isFirebaseAuthConfigured(): boolean {
  return getFirebaseClientConfig() !== null;
}
