export type UserRole = 'User' | 'Inventory Officer' | 'Admin';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Optional so we don't expose it in responses
  role: UserRole;
  reset_token?: string;
  reset_token_expires?: string;
  created_at: string;
}

export const ALL_DEPARTMENTS = [
  'Design & Development',
  'Testing',
  'EnHESQ',
  'Procurement',
  'Shipping',
  'Finance',
  'HR',
  'IT',
  'Sales & Marketing',
  'After Sales',
  'Maintenance',
  'Administration',
  'Production',
  'Inventory'
] as const;

export type RequestDepartment = typeof ALL_DEPARTMENTS[number];
export type RequestPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type RequestStatus = 'Pending Inventory Review' | 'Pending Admin Approval' | 'Approved' | 'Rejected' | 'Need More Information' | 'Completed';

export interface Material {
  id: string;
  material_id: string;
  material_name: string;
  unit: string;
  current_stock: number;
  created_at: string;
  updated_at: string;
}

export interface Tool {
  id: string;
  tool_id: string;
  tool_name: string;
  available_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface RequestMaterial {
  id: string;
  request_id: string;
  material_id: string;
  quantity: number;
  assigned_by: string;
  created_at: string;
  // Join fields
  material_name?: string;
  unit?: string;
  current_stock?: number;
}

export interface RequestTool {
  id: string;
  request_id: string;
  tool_id: string;
  quantity: number;
  assigned_by: string;
  created_at: string;
  // Join fields
  tool_name?: string;
  available_quantity?: number;
}

export interface Request {
  id: string;
  title: string;
  department: RequestDepartment;
  description: string;
  priority: RequestPriority;
  status: RequestStatus;
  attachment?: string; // Optional attachment link / file name
  created_by: string; // User ID
  created_at: string;
  updated_at: string;
  completed_by_user?: boolean;
  completed_at?: string;
  adminComments?: string; // Admin comments if any
  // Join fields for frontend display
  creator_name?: string;
  creator_email?: string;
  assigned_materials?: RequestMaterial[];
  assigned_tools?: RequestTool[];
}

export interface InventoryTransaction {
  id: string;
  request_id: string;
  item_type: 'Material' | 'Tool';
  item_id: string;
  item_name: string;
  quantity: number;
  action: string;
  performed_by: string;
  created_at: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  request_id: string;
  created_at: string;
  read: boolean;
}

export interface ActivityLog {
  id: string;
  request_id: string;
  action: string;
  description: string;
  performed_by: string; // User Name
  role: UserRole;
  created_at: string;
}

export interface EmailLog {
  id: string;
  request_id?: string;
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  status: 'Delivered (Mailtrap SMTP)' | 'Simulated (Mailtrap Virtual Inbox)' | 'Failed';
  messageId: string;
  error?: string;
  created_at: string;
}

export interface DashboardStats {
  totalRequests: number;
  pendingInventoryReview: number;
  pendingAdminApproval: number;
  approved: number;
  rejected: number;
  needMoreInfo: number;
  completed: number;
}

