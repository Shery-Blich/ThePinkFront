/**
 * Verify Auth0 ID tokens (RS256) for admin SPA login.
 * Used only by admin API routes — not by public game /api/game.
 */
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const domain = process.env.AUTH0_DOMAIN || process.env.VITE_AUTH0_DOMAIN;
const clientId = process.env.AUTH0_CLIENT_ID || process.env.VITE_AUTH0_CLIENT_ID;

let client;

function getClient() {
  if (!domain) {
    throw new Error('AUTH0_DOMAIN is not configured');
  }
  if (!client) {
    client = jwksClient({
      jwksUri: `https://${domain}/.well-known/jwks.json`,
      cache: true,
      rateLimit: true,
    });
  }
  return client;
}

function getKey(header, callback) {
  getClient().getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

/**
 * @param {string} idToken Auth0 ID token from the SPA
 * @returns {Promise<{ sub: string, email?: string, name?: string, nickname?: string }>}
 */
export function verifyAuth0IdToken(idToken) {
  if (!domain || !clientId) {
    return Promise.reject(new Error('Auth0 is not configured on the server'));
  }

  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getKey,
      {
        audience: clientId,
        issuer: `https://${domain}/`,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      }
    );
  });
}
