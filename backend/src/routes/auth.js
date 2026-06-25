import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import Admin from '../models/Admin.js';
import { requireAdmin } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validate.js';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ADMIN_WHITELIST = process.env.ADMIN_WHITELIST
  ? process.env.ADMIN_WHITELIST.split(',').map((e) => e.trim().toLowerCase())
  : [];

function issueAdminCookie(res, payload) {
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
  res.cookie('adminToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000, // 1 hour
  });
  return token;
}

// POST /api/auth/google
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

      if (!ADMIN_WHITELIST.includes(email.toLowerCase())) {
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
  res.clearCookie('adminToken', { httpOnly: true, sameSite: 'strict' });
  res.json({ message: 'Logged out' });
});

export default router;
