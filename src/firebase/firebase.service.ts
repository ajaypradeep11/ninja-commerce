import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app!: admin.app.App;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    // Token verification only needs the project id (public Google certs).
    // GOOGLE_APPLICATION_CREDENTIALS is only required for the grant-admin script.
    this.app =
      admin.apps.length > 0
        ? admin.app()
        : admin.initializeApp({
            projectId: this.config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
          });
  }

  verifyIdToken(token: string): Promise<DecodedIdToken> {
    return this.app.auth().verifyIdToken(token);
  }
}
