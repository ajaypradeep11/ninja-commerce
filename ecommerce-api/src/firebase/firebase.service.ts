import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app!: App;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    // Refuse to boot in production with the auth emulator configured:
    // firebase-admin's verifyIdToken silently skips signature verification when
    // FIREBASE_AUTH_EMULATOR_HOST is set, which would be a total auth bypass if
    // that env var ever leaked into a production environment.
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.FIREBASE_AUTH_EMULATOR_HOST
    ) {
      throw new Error(
        'Refusing to start: FIREBASE_AUTH_EMULATOR_HOST is set while NODE_ENV=production. ' +
          'The auth emulator disables ID token signature verification, so this would bypass ' +
          'all authentication. Unset FIREBASE_AUTH_EMULATOR_HOST in production.',
      );
    }

    // Token verification only needs the project id (public Google certs).
    // GOOGLE_APPLICATION_CREDENTIALS is only required for the grant-admin script.
    this.app =
      getApps().length > 0
        ? getApp()
        : initializeApp({
            projectId: this.config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
          });
  }

  verifyIdToken(token: string): Promise<DecodedIdToken> {
    return getAuth(this.app).verifyIdToken(token);
  }
}
