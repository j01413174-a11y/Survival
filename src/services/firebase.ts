import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, getDocs, deleteDoc, collection, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

/**
 * Specifically retrieves user inventory data from Firestore.
 * This reads the game save document under /users/{userId}/saves/{slotId},
 * parses the inner `saveData` JSON string, and extracts the `pl.inv` inventory object.
 * 
 * @param userId - The user's UID
 * @param slotId - The save slot ID (defaults to 'autosave')
 * @returns The player inventory object (Record<string, number>) or null if not found
 */
export async function getUserInventoryFromFirestore(userId: string, slotId: string = 'autosave'): Promise<Record<string, number> | null> {
  if (!userId) {
    throw new Error("userId is required to retrieve inventory data.");
  }
  
  const path = `users/${userId}/saves/${slotId}`;
  try {
    const saveDocRef = doc(db, 'users', userId, 'saves', slotId);
    const docSnap = await getDoc(saveDocRef);
    if (!docSnap.exists()) {
      return null;
    }
    
    const data = docSnap.data();
    if (data && data.saveData) {
      try {
        const parsedSave = JSON.parse(data.saveData);
        if (parsedSave && parsedSave.pl && parsedSave.pl.inv) {
          return parsedSave.pl.inv as Record<string, number>;
        }
      } catch (parseErr) {
        console.error("Failed to parse cloud saveData JSON:", parseErr);
        return null;
      }
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}
