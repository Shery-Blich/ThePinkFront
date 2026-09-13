import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import Admin from '../models/Admin.js';
import { requireAdmin } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validate.js';
import { verifyAuth0IdToken } from '../utils/auth0.js';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ADMIN_WHITELIST = process.env.ADMIN_WHITELIST
  ? process.env.ADMIN_WHITELIST.split(',').map((e) => e.trim().toLowerCase())
  : [];

function issueAdminCookie(res, payload) {
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
  const secureCookie =
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production';

  res.cookie('adminToken', token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000, // 1 hour
  });
  return token;
}

// POST /api/auth/auth0 — Admin SPA exchanges Auth0 ID token for API cookie
router.post(
  '/auth0',
  body('idToken').isString().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const claims = await verifyAuth0IdToken(req.body.idToken);
      const email = (claims.email || '').toLowerCase();
      const name = claims.name || claims.nickname || email || 'Admin';
      const auth0Id = claims.sub;

      if (!email) {
        return res.status(401).json({ error: 'Auth0 token missing email claim' });
      }

      if (ADMIN_WHITELIST.length && !ADMIN_WHITELIST.includes(email)) {
        return res.status(403).json({ error: 'Email not authorized as admin' });
      }

      // Reuse googleId field as stable external id (auth0|…) for minimal schema change
      const admin = await Admin.findOneAndUpdate(
        { email },
        { googleId: auth0Id, email, name },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      issueAdminCookie(res, { adminId: admin._id, email: admin.email });
      res.json({ email: admin.email, name: admin.name });
    } catch (err) {
      console.error('Auth0 token verification failed:', err.message);
      res.status(401).json({ error: 'Auth0 token verification failed' });
    }
  }
);

// POST /api/auth/google — legacy Google Sign-In (optional)
router.post(
  '/google',
  body('credential').isString().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: req.body.credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const { sub: googleId, email, name } = ticket.getPayload();

      if (ADMIN_WHITELIST.length && !ADMIN_WHITELIST.includes(email.toLowerCase())) {
        return res.status(403).json({ error: 'Email not authorized as admin' });
      }

      const admin = await Admin.findOneAndUpdate(
        { googleId },
        { googleId, email, name },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      issueAdminCookie(res, { adminId: admin._id, email: admin.email });
      res.json({ email: admin.email, name: admin.name });
    } catch (err) {
      console.error('Google auth error:', err.message);
      res.status(401).json({ error: 'Google token verification failed' });
    }
  }
);

// GET /api/auth/me
router.get('/me', requireAdmin, async (req, res) => {
  const admin = await Admin.findById(req.admin.adminId).select('-__v');
  if (!admin) return res.status(404).json({ error: 'Admin not found' });
  res.json({ email: admin.email, name: admin.name });
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  const secureCookie =
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production';

  res.clearCookie('adminToken', { httpOnly: true, sameSite: 'strict', secure: secureCookie });
  res.json({ message: 'Logged out' });
});

export default router;
