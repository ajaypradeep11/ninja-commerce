/**
 * Creates/updates the admin user in the Firebase Auth emulator.
 * The emulator must be running (see ecommerce-admin: `npm run emulators`).
 *
 * Usage: npm run seed:emulator
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const EMAIL = 'admin@example.com';
const PASSWORD = 'password123';

async function main(): Promise<void> {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  const app = initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-ecommerce',
  });
  const auth = getAuth(app);
  const user = await auth
    .getUserByEmail(EMAIL)
    .catch(() => auth.createUser({ email: EMAIL, password: PASSWORD }));
  await auth.setCustomUserClaims(user.uid, { admin: true });
  console.log(`Emulator admin ready: ${EMAIL} / ${PASSWORD} (uid ${user.uid})`);
}

void main();
