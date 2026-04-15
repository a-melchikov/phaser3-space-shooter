import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";

const REQUIRED_FIREBASE_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID"
] as const;

export function getFirebaseClientConfig(): FirebaseOptions | null {
  const hasRequiredConfig = REQUIRED_FIREBASE_KEYS.every((key) => {
    const value = import.meta.env[key];
    return typeof value === "string" && value.trim().length > 0;
  });

  if (!hasRequiredConfig) {
    return null;
  }

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined
  };
}

export function isFirebaseAuthConfigured(): boolean {
  return getFirebaseClientConfig() !== null;
}

export function getFirebaseApp(): FirebaseApp | null {
  const config = getFirebaseClientConfig();

  if (!config) {
    return null;
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(config);
}
