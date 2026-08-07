import { Response } from 'express';
import { db } from '../db/db';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /api/materials
 * Fetch all materials
 */
export async function getMaterials(req: AuthenticatedRequest, res: Response) {
  try {
    const { search } = req.query;
    let materials = db.getMaterials();

    if (search) {
      const searchStr = (search as string).toLowerCase().trim();
      materials = materials.filter(m => 
        m.material_id.toLowerCase().includes(searchStr) ||
        m.material_name.toLowerCase().includes(searchStr) ||
        m.unit.toLowerCase().includes(searchStr)
      );
    }

    materials.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return res.status(200).json({ materials });
  } catch (error) {
    console.error('Get materials error:', error);
    return res.status(500).json({ message: 'Internal server error fetching materials' });
  }
}

/**
 * POST /api/materials
 * Create a new material (Inventory Officer & Admin)
 */
export async function createMaterial(req: AuthenticatedRequest, res: Response) {
  const { material_name, unit, current_stock } = req.body;

  if (!material_name || !material_name.trim()) {
    return res.status(400).json({ message: 'Material name is required' });
  }

  if (!unit || !unit.trim()) {
    return res.status(400).json({ message: 'Unit is required' });
  }

  const stockNum = parseInt(current_stock ?? 0);
  if (isNaN(stockNum) || stockNum < 0) {
    return res.status(400).json({ message: 'Current stock must be a non-negative number' });
  }

  try {
    const newMat = db.createMaterial({
      material_name: material_name.trim(),
      unit: unit.trim(),
      current_stock: stockNum
    });

    db.createInventoryTransaction({
      request_id: 'SYSTEM',
      item_type: 'Material',
      item_id: newMat.material_id,
      item_name: newMat.material_name,
      quantity: stockNum,
      action: 'Initial Stock Addition',
      performed_by: req.user?.name || 'System'
    });

    return res.status(201).json({
      message: 'Material created successfully',
      material: newMat
    });
  } catch (error) {
    console.error('Create material error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * PUT /api/materials/:id
 * Update material details
 */
export async function updateMaterial(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { material_name, unit, current_stock } = req.body;

  try {
    const existing = db.findMaterialById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Material not found' });
    }

    const updates: any = {};
    if (material_name !== undefined) updates.material_name = material_name.trim();
    if (unit !== undefined) updates.unit = unit.trim();
    if (current_stock !== undefined) {
      const stockNum = parseInt(current_stock);
      if (isNaN(stockNum) || stockNum < 0) {
        return res.status(400).json({ message: 'Current stock must be a non-negative number' });
      }
      
      const diff = stockNum - existing.current_stock;
      if (diff !== 0) {
        db.createInventoryTransaction({
          request_id: 'SYSTEM',
          item_type: 'Material',
          item_id: existing.material_id,
          item_name: existing.material_name,
          quantity: Math.abs(diff),
          action: diff > 0 ? 'Stock Increase' : 'Stock Decrease',
          performed_by: req.user?.name || 'System'
        });
      }
      updates.current_stock = stockNum;
    }

    const updated = db.updateMaterial(id, updates);
    return res.status(200).json({
      message: 'Material updated successfully',
      material: updated
    });
  } catch (error) {
    console.error('Update material error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * DELETE /api/materials/:id
 * Delete a material
 */
export async function deleteMaterial(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  try {
    const mat = db.findMaterialById(id);
    if (!mat) {
      return res.status(404).json({ message: 'Material not found' });
    }

    db.deleteMaterial(id);
    return res.status(200).json({ message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Delete material error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * GET /api/tools
 * Fetch all tools
 */
export async function getTools(req: AuthenticatedRequest, res: Response) {
  try {
    const { search } = req.query;
    let tools = db.getTools();

    if (search) {
      const searchStr = (search as string).toLowerCase().trim();
      tools = tools.filter(t => 
        t.tool_id.toLowerCase().includes(searchStr) ||
        t.tool_name.toLowerCase().includes(searchStr)
      );
    }

    tools.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return res.status(200).json({ tools });
  } catch (error) {
    console.error('Get tools error:', error);
    return res.status(500).json({ message: 'Internal server error fetching tools' });
  }
}

/**
 * POST /api/tools
 * Create a new tool
 */
export async function createTool(req: AuthenticatedRequest, res: Response) {
  const { tool_name, available_quantity } = req.body;

  if (!tool_name || !tool_name.trim()) {
    return res.status(400).json({ message: 'Tool name is required' });
  }

  const qtyNum = parseInt(available_quantity ?? 0);
  if (isNaN(qtyNum) || qtyNum < 0) {
    return res.status(400).json({ message: 'Available quantity must be a non-negative number' });
  }

  try {
    const newTool = db.createTool({
      tool_name: tool_name.trim(),
      available_quantity: qtyNum
    });

    db.createInventoryTransaction({
      request_id: 'SYSTEM',
      item_type: 'Tool',
      item_id: newTool.tool_id,
      item_name: newTool.tool_name,
      quantity: qtyNum,
      action: 'Initial Tool Registration',
      performed_by: req.user?.name || 'System'
    });

    return res.status(201).json({
      message: 'Tool created successfully',
      tool: newTool
    });
  } catch (error) {
    console.error('Create tool error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * PUT /api/tools/:id
 * Update tool details
 */
export async function updateTool(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { tool_name, available_quantity } = req.body;

  try {
    const existing = db.findToolById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Tool not found' });
    }

    const updates: any = {};
    if (tool_name !== undefined) updates.tool_name = tool_name.trim();
    if (available_quantity !== undefined) {
      const qtyNum = parseInt(available_quantity);
      if (isNaN(qtyNum) || qtyNum < 0) {
        return res.status(400).json({ message: 'Available quantity must be a non-negative number' });
      }

      const diff = qtyNum - existing.available_quantity;
      if (diff !== 0) {
        db.createInventoryTransaction({
          request_id: 'SYSTEM',
          item_type: 'Tool',
          item_id: existing.tool_id,
          item_name: existing.tool_name,
          quantity: Math.abs(diff),
          action: diff > 0 ? 'Tool Quantity Increase' : 'Tool Quantity Decrease',
          performed_by: req.user?.name || 'System'
        });
      }
      updates.available_quantity = qtyNum;
    }

    const updated = db.updateTool(id, updates);
    return res.status(200).json({
      message: 'Tool updated successfully',
      tool: updated
    });
  } catch (error) {
    console.error('Update tool error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * DELETE /api/tools/:id
 * Delete a tool
 */
export async function deleteTool(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  try {
    const tool = db.findToolById(id);
    if (!tool) {
      return res.status(404).json({ message: 'Tool not found' });
    }

    db.deleteTool(id);
    return res.status(200).json({ message: 'Tool deleted successfully' });
  } catch (error) {
    console.error('Delete tool error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * GET /api/inventory/transactions
 * Fetch transaction history
 */
export async function getInventoryTransactions(req: AuthenticatedRequest, res: Response) {
  try {
    const transactions = db.getInventoryTransactions();
    transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return res.status(200).json({ transactions });
  } catch (error) {
    console.error('Get inventory transactions error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

