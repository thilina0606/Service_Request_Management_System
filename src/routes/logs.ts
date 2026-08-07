import { Router } from 'express';
import { 
  getEmailLogs, 
  clearEmailLogs, 
  getActivityLogs, 
  clearActivityLogs, 
  postTestEmail 
} from '../controllers/logController';
import { authenticateUser, authorizeAdmin } from '../middleware/auth';

const router = Router();

// Protect log routes: authenticated & admin only
router.use(authenticateUser as any);
router.use(authorizeAdmin as any);

router.get('/email', getEmailLogs as any);
router.delete('/email', clearEmailLogs as any);

router.get('/activity', getActivityLogs as any);
router.delete('/activity', clearActivityLogs as any);

router.post('/test-email', postTestEmail as any);

export default router;
