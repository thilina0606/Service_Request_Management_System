import { Router } from 'express';
import { register, login, getMe, forgotPassword, resetPassword } from '../controllers/authController';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Public auth endpoints
router.post('/register', register as any);
router.post('/login', login as any);
router.post('/forgot-password', forgotPassword as any);
router.post('/reset-password', resetPassword as any);

// Protected profile endpoint
router.get('/me', authenticateUser as any, getMe as any);

export default router;
