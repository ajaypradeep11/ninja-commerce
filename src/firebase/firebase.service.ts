import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app!: App;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
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
