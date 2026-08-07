import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore,
  setLogLevel,
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Set Firestore log level to error to prevent benign idle connection logs
setLogLevel('error');

// Initialize Firebase App
const firebaseApp = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID and long polling configuration for Node environment
const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
export const firestore = initializeFirestore(firebaseApp, {
  experimentalAutoDetectLongPolling: true
}, databaseId);

export {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch
};

