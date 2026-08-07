import { Router } from 'express';
import { 
  getReportSummary, 
  getReportPdf, 
  getReportExcel, 
  getReportCsv 
} from '../controllers/reportController';
import { authenticateUser, authorizeAdmin } from '../middleware/auth';

const router = Router();

// Protect all report endpoints. Must be authenticated and must be an Admin
router.use(authenticateUser as any);
router.use(authorizeAdmin as any);

router.get('/summary', getReportSummary as any);
router.get('/pdf', getReportPdf as any);
router.get('/excel', getReportExcel as any);
router.get('/csv', getReportCsv as any);

export default router;
