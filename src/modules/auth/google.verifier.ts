import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { GoogleIdentityVerifier } from './auth.types.js';

const googleIssuer = 'https://accounts.google.com';

export class JoseGoogleIdentityVerifier implements GoogleIdentityVerifier {
  private readonly jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

  constructor(private readonly clientId: string) {}

  async verify(idToken: string) {
    if (!this.clientId) {
      throw new Error('GOOGLE_CLIENT_ID is not configured.');
    }

    const { payload } = await jwtVerify(idToken, this.jwks, {
      issuer: googleIssuer,
      audience: this.clientId
    });

    const email = payload.email;
    const googleId = payload.sub;

    if (typeof email !== 'string' || typeof googleId !== 'string') {
      throw new Error('Invalid Google identity token.');
    }

    return {
      email,
      googleId,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      avatarUrl: typeof payload.picture === 'string' ? payload.picture : undefined
    };
  }
}
