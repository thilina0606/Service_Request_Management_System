import { Router } from 'express';
import { 
  createRequest, 
  getRequests, 
  getRequestDetails, 
  updateRequestStatus, 
  assignMaterialsAndTools,
  addComment, 
  deleteRequest, 
  getStats,
  completeRequest,
  getNotifications,
  markNotificationAsRead
} from '../controllers/requestController';
import { authenticateUser, authorizeAdmin, authorizeInventoryOfficer } from '../middleware/auth';

const router = Router();

// Protect all request routes with session authentication
router.use(authenticateUser as any);

// Notifications routes for Administrator
router.get('/notifications', authorizeAdmin as any, getNotifications as any);
router.put('/notifications/:id/read', authorizeAdmin as any, markNotificationAsRead as any);

// Dashboard KPI statistics
router.get('/stats', getStats as any);

// General request list & submit
router.get('/', getRequests as any);
router.post('/', createRequest as any);

// Individual request operations
router.get('/:id', getRequestDetails as any);
router.put('/:id/comment', addComment as any);
router.put('/:id/complete', completeRequest as any);

// Inventory Officer assignment endpoint
router.post('/:id/assign-materials-tools', authorizeInventoryOfficer as any, assignMaterialsAndTools as any);

// Administrator-only request controls
router.put('/:id/status', authorizeAdmin as any, updateRequestStatus as any);
router.delete('/:id', authorizeAdmin as any, deleteRequest as any);

export default router;

