export interface VerifiedFirebaseIdentity {
  firebaseUid: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export interface AuthenticatedPlayer extends VerifiedFirebaseIdentity {
  playerId: string;
}
