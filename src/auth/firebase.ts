import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

const app =
  getApps()[0] ??
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });

export const auth = getAuth(app);

if (
  process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' &&
  typeof window !== 'undefined'
) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9098', {
    disableWarnings: true,
  });
}

if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_USE_EMULATORS !== 'true' &&
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'fake-api-key'
) {
  console.error(
    'Everloom misconfiguration: placeholder Firebase config reached a production runtime. Set real NEXT_PUBLIC_FIREBASE_* env vars in the hosting platform.',
  );
}
