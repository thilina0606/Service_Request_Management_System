import { Response } from 'express';
import { db } from '../db/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { RequestDepartment, RequestPriority, RequestStatus, ALL_DEPARTMENTS } from '../types';
import { 
  sendNewRequestNotifications, 
  sendInventoryReviewedNotifications, 
  sendAdminDecisionNotifications, 
  sendUserProvidedInfoNotification, 
  sendWorkCompletedNotifications 
} from '../services/email';

function getRoleEmails(role: 'Admin' | 'Inventory Officer' | 'User'): string[] {
  const users = db.getUsers().filter(u => u.role === role);
  const emails = users.map(u => u.email).filter(Boolean);
  if (emails.length === 0) {
    if (role === 'Inventory Officer') return ['officer@example.com'];
    if (role === 'Admin') return ['admin@example.com'];
  }
  return emails;
}

export async function createRequest(req: AuthenticatedRequest, res: Response) {
  const { title, department, description, priority, attachment } = req.body;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  // Inputs Validation
  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Title is required' });
  }

  if (!ALL_DEPARTMENTS.includes(department as any)) {
    return res.status(400).json({ message: `Invalid department. Allowed departments: ${ALL_DEPARTMENTS.join(', ')}` });
  }

  if (!description || !description.trim()) {
    return res.status(400).json({ message: 'Problem description is required' });
  }

  const validPriorities: RequestPriority[] = ['Low', 'Medium', 'High', 'Urgent'];
  if (!priority || !validPriorities.includes(priority)) {
    return res.status(400).json({ message: 'Invalid priority level' });
  }

  try {
    const newReq = db.createRequest({
      title: title.trim(),
      department: department as RequestDepartment,
      description: description.trim(),
      priority: priority as RequestPriority,
      status: 'Pending Inventory Review',
      attachment: attachment ? attachment.trim() : undefined,
      created_by: user.id
    });

    // Create activity log
    db.createActivityLog({
      request_id: newReq.id,
      action: 'Submitted Request',
      description: `Request "${newReq.title}" submitted by ${user.name}. Status: Pending Inventory Review.`,
      performed_by: user.name,
      role: user.role
    });

    // Send Mailtrap email notifications to Inventory Officer and User receipt
    const officerEmails = getRoleEmails('Inventory Officer');
    sendNewRequestNotifications({ name: user.name, email: user.email }, newReq, officerEmails)
      .catch(err => console.error('Error sending creation notification email:', err));

    return res.status(201).json({
      message: 'Request submitted successfully',
      request: newReq
    });
  } catch (error) {
    console.error('Create request error:', error);
    return res.status(500).json({ message: 'Internal server error while creating request' });
  }
}

export async function assignMaterialsAndTools(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  const { id } = req.params;
  const { materials, tools } = req.body; // arrays of { material_id/tool_id, quantity }

  if (!user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const request = db.findRequestById(id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const assignedMaterials: { material_id: string; quantity: number }[] = [];
    const assignedTools: { tool_id: string; quantity: number }[] = [];

    if (materials && Array.isArray(materials)) {
      for (const m of materials) {
        if (m.material_id && m.quantity > 0) {
          const mat = db.findMaterialById(m.material_id);
          if (!mat) {
            return res.status(400).json({ message: `Material ${m.material_id} not found in inventory` });
          }
          assignedMaterials.push({ material_id: mat.id, quantity: parseInt(m.quantity) });
        }
      }
    }

    if (tools && Array.isArray(tools)) {
      for (const t of tools) {
        if (t.tool_id && t.quantity > 0) {
          const tool = db.findToolById(t.tool_id);
          if (!tool) {
            return res.status(400).json({ message: `Tool ${t.tool_id} not found in inventory` });
          }
          assignedTools.push({ tool_id: tool.id, quantity: parseInt(t.quantity) });
        }
      }
    }

    // Validation: MUST assign at least ONE Material OR at least ONE Tool
    if (assignedMaterials.length === 0 && assignedTools.length === 0) {
      return res.status(400).json({
        message: 'Validation Error: Inventory Officer must assign at least ONE Material OR at least ONE Tool before submitting to Admin.'
      });
    }

    // Save assignments in DB
    db.assignMaterialsAndTools(id, assignedMaterials, assignedTools, user.name);

    // Update status to Pending Admin Approval
    const updated = db.updateRequest(id, { status: 'Pending Admin Approval' });

    // Activity Log
    db.createActivityLog({
      request_id: id,
      action: 'Inventory Review Completed',
      description: `Assigned ${assignedMaterials.length} material(s) and ${assignedTools.length} tool(s). Request submitted to Admin for approval by ${user.name}.`,
      performed_by: user.name,
      role: user.role
    });

    // Send Mailtrap email notifications to Admin and User
    if (updated) {
      const adminEmails = getRoleEmails('Admin');
      const creator = db.findUserById(request.created_by);
      const userObj = creator ? { name: creator.name, email: creator.email } : { name: 'Requester', email: 'user@example.com' };
      sendInventoryReviewedNotifications(user.name, updated, adminEmails, userObj, assignedMaterials.length, assignedTools.length)
        .catch(err => console.error('Error sending inventory review notification email:', err));
    }

    return res.status(200).json({
      message: 'Materials & tools assigned and request submitted to Admin',
      request: updated
    });
  } catch (error) {
    console.error('Assign materials and tools error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getRequests(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const { search, status, department, priority } = req.query;

  try {
    let requests = db.getRequests();
    const allUsers = db.getUsers();

    requests = requests.map(r => {
      const creator = allUsers.find(u => u.id === r.created_by);
      return {
        ...r,
        creator_name: creator ? creator.name : 'Unknown User',
        creator_email: creator ? creator.email : 'unknown@example.com'
      };
    });

    // If regular user, restrict ONLY to their own requests
    if (user.role === 'User') {
      requests = requests.filter(r => r.created_by === user.id);
    }

    if (department) {
      requests = requests.filter(r => r.department === department);
    }

    if (status) {
      requests = requests.filter(r => r.status === status);
    }

    if (priority) {
      requests = requests.filter(r => r.priority === priority);
    }

    if (search) {
      const searchStr = (search as string).toLowerCase().trim();
      requests = requests.filter(r => {
        const idMatches = r.id.toLowerCase().includes(searchStr);
        const titleMatches = r.title.toLowerCase().includes(searchStr);
        const deptMatches = r.department.toLowerCase().includes(searchStr);
        const statusMatches = r.status.toLowerCase().includes(searchStr);
        const priorityMatches = r.priority.toLowerCase().includes(searchStr);
        const userMatches = r.creator_name?.toLowerCase().includes(searchStr);
        return idMatches || titleMatches || deptMatches || statusMatches || priorityMatches || userMatches;
      });
    }

    // Default order by priority (Urgent > High > Medium > Low) and then newest first
    const priorityWeight: Record<string, number> = {
      'Urgent': 4,
      'High': 3,
      'Medium': 2,
      'Low': 1
    };

    requests.sort((a, b) => {
      const weightA = priorityWeight[a.priority] || 0;
      const weightB = priorityWeight[b.priority] || 0;
      if (weightB !== weightA) {
        return weightB - weightA;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return res.status(200).json({ requests });
  } catch (error) {
    console.error('Get requests error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getRequestDetails(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  const { id } = req.params;

  if (!user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const request = db.findRequestById(id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (user.role === 'User' && request.created_by !== user.id) {
      return res.status(403).json({ message: 'Forbidden: You cannot access other users\' requests' });
    }

    const creator = db.findUserById(request.created_by);
    const detailedRequest = {
      ...request,
      creator_name: creator ? creator.name : 'Unknown User',
      creator_email: creator ? creator.email : 'unknown@example.com'
    };

    const logs = db.getActivityLogs(id);
    logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const assigned_materials = db.getRequestMaterialsByRequestId(id);
    const assigned_tools = db.getRequestToolsByRequestId(id);

    return res.status(200).json({
      request: detailedRequest,
      assigned_materials,
      assigned_tools,
      timeline: logs
    });
  } catch (error) {
    console.error('Get request details error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateRequestStatus(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  const { id } = req.params;
  const { status, comments } = req.body;

  if (!user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const validStatuses: RequestStatus[] = ['Pending Inventory Review', 'Pending Admin Approval', 'Approved', 'Rejected', 'Need More Information', 'Completed'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid request status' });
  }

  try {
    const request = db.findRequestById(id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const oldStatus = request.status;
    const updated = db.updateRequest(id, { status: status as RequestStatus });

    if (!updated) {
      return res.status(500).json({ message: 'Failed to update request' });
    }

    db.createActivityLog({
      request_id: id,
      action: status === 'Need More Information' ? 'Information Required' : `Status: ${status}`,
      description: `Status updated from "${oldStatus}" to "${status}" by ${user.name}.${comments ? ' Comment: ' + comments : ''}`,
      performed_by: user.name,
      role: user.role
    });

    const creator = db.findUserById(request.created_by);
    if (creator && updated) {
      const officerEmails = getRoleEmails('Inventory Officer');
      sendAdminDecisionNotifications(user.name, updated, comments || '', { name: creator.name, email: creator.email }, officerEmails)
        .catch(err => console.error('Error sending user email notification:', err));
    }

    return res.status(200).json({
      message: 'Request status updated successfully',
      request: updated
    });
  } catch (error) {
    console.error('Update status error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function addComment(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  const { id } = req.params;
  const { comments } = req.body;

  if (!user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (!comments || !comments.trim()) {
    return res.status(400).json({ message: 'Comment body is required' });
  }

  try {
    const request = db.findRequestById(id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (user.role === 'User' && request.created_by !== user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    db.createActivityLog({
      request_id: id,
      action: 'Comment Added',
      description: `Comment by ${user.name}: "${comments.trim()}"`,
      performed_by: user.name,
      role: user.role
    });

    let updatedRequest = request;
    if (user.role === 'User' && request.status === 'Need More Information') {
      const nextReq = db.updateRequest(id, { status: 'Pending Inventory Review' });
      if (nextReq) {
        updatedRequest = nextReq;
        db.createActivityLog({
          request_id: id,
          action: 'Status: Pending Inventory Review',
          description: 'Status automatically changed to Pending Inventory Review because requester provided updated information.',
          performed_by: 'System',
          role: 'Inventory Officer'
        });

        // Notify Inventory Officer that requester replied
        const officerEmails = getRoleEmails('Inventory Officer');
        sendUserProvidedInfoNotification({ name: user.name, email: user.email }, updatedRequest, comments.trim(), officerEmails)
          .catch(err => console.error('Error sending info updated notification email:', err));
      }
    }

    const logs = db.getActivityLogs(id);
    logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return res.status(200).json({
      message: 'Comment added successfully',
      request: updatedRequest,
      timeline: logs
    });
  } catch (error) {
    console.error('Add comment error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function deleteRequest(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  try {
    const request = db.findRequestById(id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    db.deleteRequest(id);

    return res.status(200).json({
      message: 'Request and history logs deleted successfully'
    });
  } catch (error) {
    console.error('Delete request error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getStats(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    let requests = db.getRequests();
    let logs = db.getActivityLogs();

    if (user.role === 'User') {
      requests = requests.filter(r => r.created_by === user.id);
      const userRequestIds = requests.map(r => r.id);
      logs = logs.filter(log => userRequestIds.includes(log.request_id));
    }

    const totalRequests = requests.length;
    const pendingInventoryReview = requests.filter(r => r.status === 'Pending Inventory Review').length;
    const pendingAdminApproval = requests.filter(r => r.status === 'Pending Admin Approval').length;
    const approved = requests.filter(r => r.status === 'Approved').length;
    const rejected = requests.filter(r => r.status === 'Rejected').length;
    const needMoreInfo = requests.filter(r => r.status === 'Need More Information').length;
    const completed = requests.filter(r => r.status === 'Completed').length;

    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const recentActivity = logs.slice(0, 15);

    return res.status(200).json({
      stats: {
        totalRequests,
        pendingInventoryReview,
        pendingAdminApproval,
        approved,
        rejected,
        needMoreInfo,
        completed
      },
      recentActivity
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function completeRequest(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  const { id } = req.params;

  if (!user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const request = db.findRequestById(id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (user.role === 'User' && request.created_by !== user.id) {
      return res.status(403).json({ message: 'Forbidden: You can only complete your own requests' });
    }

    if (request.status !== 'Approved') {
      return res.status(400).json({ message: 'Only approved requests can be marked as completed' });
    }

    // Process Materials Stock Reduction and Inventory Transactions
    const assignedMaterials = db.getRequestMaterialsByRequestId(id);
    for (const rm of assignedMaterials) {
      const mat = db.findMaterialById(rm.material_id);
      if (mat) {
        const newStock = Math.max(0, mat.current_stock - rm.quantity);
        db.updateMaterial(mat.id, { current_stock: newStock });

        db.createInventoryTransaction({
          request_id: id,
          item_type: 'Material',
          item_id: mat.material_id,
          item_name: mat.material_name,
          quantity: rm.quantity,
          action: 'Deduction',
          performed_by: user.name
        });
      }
    }

    // Process Tools Used and Transactions
    const assignedTools = db.getRequestToolsByRequestId(id);
    for (const rt of assignedTools) {
      const tool = db.findToolById(rt.tool_id);
      if (tool) {
        db.createInventoryTransaction({
          request_id: id,
          item_type: 'Tool',
          item_id: tool.tool_id,
          item_name: tool.tool_name,
          quantity: rt.quantity,
          action: 'Tool Assigned / Used',
          performed_by: user.name
        });
      }
    }

    const updated = db.updateRequest(id, { 
      status: 'Completed',
      completed_by_user: true,
      completed_at: new Date().toISOString()
    });

    if (!updated) {
      return res.status(500).json({ message: 'Failed to update request' });
    }

    db.createActivityLog({
      request_id: id,
      action: 'Completed by User',
      description: `Work completion confirmed by ${user.name}. Material stock reduced automatically.`,
      performed_by: user.name,
      role: user.role
    });

    db.createNotification({
      title: 'Work Completed',
      message: `User ${user.name} confirmed work completion for request ${id}.`,
      request_id: id
    });

    const adminEmails = getRoleEmails('Admin');
    const officerEmails = getRoleEmails('Inventory Officer');

    sendWorkCompletedNotifications({ name: user.name, email: user.email }, updated, adminEmails, officerEmails)
      .catch(err => console.error('Error sending work completed email notifications:', err));

    return res.status(200).json({
      message: 'Request marked as completed successfully',
      request: updated
    });
  } catch (error) {
    console.error('Complete request error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getNotifications(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  if (!user || user.role !== 'Admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const notifications = db.getNotifications().filter(n => !n.read);
    return res.status(200).json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function markNotificationAsRead(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  const { id } = req.params;
  if (!user || user.role !== 'Admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const success = db.markNotificationAsRead(id);
    if (!success) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    return res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

