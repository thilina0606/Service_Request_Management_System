import { Router } from 'express';
import { 
  getMaterials, 
  createMaterial, 
  updateMaterial, 
  deleteMaterial,
  getTools,
  createTool,
  updateTool,
  deleteTool,
  getInventoryTransactions 
} from '../controllers/inventoryController';
import { authenticateUser, authorizeInventoryOfficer } from '../middleware/auth';

const router = Router();

// Protect all routes with authentication
router.use(authenticateUser as any);

// Materials routes
router.get('/materials', getMaterials as any);
router.post('/materials', authorizeInventoryOfficer as any, createMaterial as any);
router.put('/materials/:id', authorizeInventoryOfficer as any, updateMaterial as any);
router.delete('/materials/:id', authorizeInventoryOfficer as any, deleteMaterial as any);

// Tools routes
router.get('/tools', getTools as any);
router.post('/tools', authorizeInventoryOfficer as any, createTool as any);
router.put('/tools/:id', authorizeInventoryOfficer as any, updateTool as any);
router.delete('/tools/:id', authorizeInventoryOfficer as any, deleteTool as any);

// Inventory transactions history log
router.get('/transactions', getInventoryTransactions as any);

export default router;

