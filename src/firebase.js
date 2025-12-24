import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// ⚠️ IMPORTANT: Replace these values with your own Firebase config
// Get this from: Firebase Console → Project Settings → Your apps → Web app
const firebaseConfig = {
  apiKey: "AIzaSyBVz-rnTsR9HvKzGV4BzerF0dVCNox5hYs",
  authDomain: "ai-scheduler-ab53e.firebaseapp.com",
  projectId: "ai-scheduler-ab53e",
  storageBucket: "ai-scheduler-ab53e.firebasestorage.app",
  messagingSenderId: "508123925302",
  appId: "1:508123925302:web:b80cce94d8b754a0da0197"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Enable offline persistence (works even without internet)
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('⚠️ Multiple tabs open, persistence enabled in first tab only');
    } else if (err.code === 'unimplemented') {
      console.warn('⚠️ Browser doesn\'t support offline persistence');
    }
  });

// Initialize Auth
export const auth = getAuth(app);

// Instructions for setup:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project (or select existing)
// 3. Click "Add app" → Web (</>) icon
// 4. Register your app with a nickname
// 5. Copy the firebaseConfig object
// 6. Replace the values above with your config
// 7. Save this file