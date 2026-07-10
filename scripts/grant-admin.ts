/**
 * Grants the `admin: true` custom claim to a Firebase user by email.
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON.
 *
 * Usage: npm run grant-admin -- admin@example.com
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npm run grant-admin -- <email>');
    process.exit(1);
  }
  const app = initializeApp(
    process.env.FIREBASE_AUTH_EMULATOR_HOST
      ? { projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-ecommerce' }
      : { credential: applicationDefault() },
  );
  const auth = getAuth(app);
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, { admin: true });
  console.log(`Granted admin claim to ${email} (uid ${user.uid}).`);
  console.log('The user must sign out and back in to refresh their token.');
}

void main();
