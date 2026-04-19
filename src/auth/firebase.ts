import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";

import { getFirebaseClientConfig } from "./firebaseConfig";

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
