import fs from 'fs';
import path from 'path';
import bcryptjs from 'bcryptjs';
import { 
  firestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  writeBatch 
} from './firebase';
import { 
  User, 
  Request, 
  ActivityLog, 
  UserRole, 
  Notification, 
  Material, 
  Tool, 
  RequestMaterial, 
  RequestTool, 
  InventoryTransaction,
  EmailLog
} from '../types';

const DB_PATH = path.join(process.cwd(), 'database.json');

interface DatabaseSchema {
  users: User[];
  requests: Request[];
  activity_logs: ActivityLog[];
  notifications?: Notification[];
  materials: Material[];
  tools: Tool[];
  request_materials: RequestMaterial[];
  request_tools: RequestTool[];
  inventory_transactions: InventoryTransaction[];
  email_logs?: EmailLog[];
}

class Database {
  private data: DatabaseSchema = {
    users: [],
    requests: [],
    activity_logs: [],
    materials: [],
    tools: [],
    request_materials: [],
    request_tools: [],
    inventory_transactions: [],
    email_logs: []
  };

  private isFirestoreLoaded = false;
  private isSyncing = false;

  constructor() {
    this.initLocal();
    this.initFirestore().catch(err => {
      console.error('Failed to sync Firestore on startup:', err);
    });
  }

  private initLocal() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        this.data = JSON.parse(raw);
        this.ensureDataStructure();
        this.ensureDefaultUsers();
      } else {
        this.seedLocal();
      }
    } catch (error) {
      console.error('Failed to initialize local database, seeding defaults...', error);
      this.seedLocal();
    }
  }

  private ensureDataStructure() {
    if (!this.data.users) this.data.users = [];
    if (!this.data.requests) this.data.requests = [];
    if (!this.data.activity_logs) this.data.activity_logs = [];
    if (!this.data.notifications) this.data.notifications = [];
    if (!this.data.materials) this.data.materials = [];
    if (!this.data.tools) this.data.tools = [];
    if (!this.data.request_materials) this.data.request_materials = [];
    if (!this.data.request_tools) this.data.request_tools = [];
    if (!this.data.inventory_transactions) this.data.inventory_transactions = [];
    if (!this.data.email_logs) this.data.email_logs = [];
  }

  /**
   * Load data from Firebase Firestore.
   * If Firestore is empty, upload seed data to Firestore.
   */
  public async initFirestore() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      console.log('🔥 Connecting to Firestore database...');
      const usersSnap = await getDocs(collection(firestore, 'users'));
      
      if (usersSnap.empty) {
        console.log('🌱 Firestore database is empty. Seeding Firestore with initial dataset...');
        await this.seedFirestore();
      } else {
        console.log(`🔥 Hydrating database from Firestore (${usersSnap.size} users found)...`);
        await this.loadFromFirestore();
      }
      this.isFirestoreLoaded = true;
      console.log('✅ Firestore sync completed successfully!');
    } catch (error) {
      console.error('⚠️ Firestore synchronization warning (using local persistent fallback):', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async loadFromFirestore() {
    try {
      const collections: (keyof DatabaseSchema)[] = [
        'users',
        'requests',
        'activity_logs',
        'notifications',
        'materials',
        'tools',
        'request_materials',
        'request_tools',
        'inventory_transactions',
        'email_logs'
      ];

      for (const colName of collections) {
        const snap = await getDocs(collection(firestore, colName));
        const items: any[] = [];
        snap.forEach(docSnap => {
          items.push(docSnap.data());
        });
        (this.data as any)[colName] = items;
      }

      this.ensureDataStructure();
      this.ensureDefaultUsers();
      this.saveLocal();
    } catch (error) {
      console.error('Error loading collections from Firestore:', error);
    }
  }

  private async seedFirestore() {
    this.seedLocal();
    const collections: (keyof DatabaseSchema)[] = [
      'users',
      'requests',
      'activity_logs',
      'notifications',
      'materials',
      'tools',
      'request_materials',
      'request_tools',
      'inventory_transactions',
      'email_logs'
    ];

    for (const colName of collections) {
      const items = (this.data as any)[colName] || [];
      for (const item of items) {
        if (item && item.id) {
          await setDoc(doc(firestore, colName, String(item.id)), item);
        }
      }
    }
  }

  private ensureDefaultUsers() {
    const salt = bcryptjs.genSaltSync(10);
    const defaultPasswordHash = bcryptjs.hashSync('password123', salt);

    const defaultUsers: User[] = [
      {
        id: 'u_1',
        name: 'John Doe',
        email: 'user@example.com',
        password: defaultPasswordHash,
        role: 'User',
        created_at: new Date('2026-07-20T08:00:00Z').toISOString()
      },
      {
        id: 'u_officer',
        name: 'Alex Inventory',
        email: 'officer@example.com',
        password: defaultPasswordHash,
        role: 'Inventory Officer',
        created_at: new Date('2026-07-20T07:30:00Z').toISOString()
      },
      {
        id: 'u_admin',
        name: 'Admin Manager',
        email: 'admin@example.com',
        password: defaultPasswordHash,
        role: 'Admin',
        created_at: new Date('2026-07-20T07:00:00Z').toISOString()
      }
    ];

    let changed = false;
    for (const defUser of defaultUsers) {
      const existing = this.data.users.find(u => u.email.toLowerCase() === defUser.email.toLowerCase());
      if (!existing) {
        this.data.users.push(defUser);
        this.saveToFirestore('users', defUser.id, defUser);
        changed = true;
      }
    }

    if (changed) {
      this.saveLocal();
    }
  }

  private seedLocal() {
    const salt = bcryptjs.genSaltSync(10);
    const defaultPasswordHash = bcryptjs.hashSync('password123', salt);

    this.data = {
      users: [
        {
          id: 'u_1',
          name: 'John Doe',
          email: 'user@example.com',
          password: defaultPasswordHash,
          role: 'User',
          created_at: new Date('2026-07-20T08:00:00Z').toISOString()
        },
        {
          id: 'u_officer',
          name: 'Alex Inventory',
          email: 'officer@example.com',
          password: defaultPasswordHash,
          role: 'Inventory Officer',
          created_at: new Date('2026-07-20T07:30:00Z').toISOString()
        },
        {
          id: 'u_admin',
          name: 'Admin Manager',
          email: 'admin@example.com',
          password: defaultPasswordHash,
          role: 'Admin',
          created_at: new Date('2026-07-20T07:00:00Z').toISOString()
        }
      ],
      requests: [
        {
          id: 'req_1001',
          title: 'HVAC Fan Noise in Workshop',
          department: 'Maintenance',
          description: 'The primary exhaust fan in Workshop B is making a loud metallic grinding sound when running. Needs inspection before it fails completely.',
          priority: 'High',
          status: 'Pending Inventory Review',
          created_by: 'u_1',
          created_at: new Date('2026-07-20T09:30:00Z').toISOString(),
          updated_at: new Date('2026-07-20T10:00:00Z').toISOString()
        },
        {
          id: 'req_1002',
          title: 'Conveyor Belt Calibration',
          department: 'Production',
          description: 'The packing line 3 conveyor belt is slipping intermittently, causing delays in boxed item scanning.',
          priority: 'Medium',
          status: 'Pending Inventory Review',
          created_by: 'u_1',
          created_at: new Date('2026-07-20T11:15:00Z').toISOString(),
          updated_at: new Date('2026-07-20T11:15:00Z').toISOString()
        }
      ],
      activity_logs: [
        {
          id: 'log_1',
          request_id: 'req_1001',
          action: 'Submitted Request',
          description: 'Request for HVAC inspection was successfully submitted by John Doe.',
          performed_by: 'John Doe',
          role: 'User',
          created_at: new Date('2026-07-20T09:30:00Z').toISOString()
        },
        {
          id: 'log_2',
          request_id: 'req_1002',
          action: 'Submitted Request',
          description: 'Request for Conveyor Belt Calibration was successfully submitted by John Doe.',
          performed_by: 'John Doe',
          role: 'User',
          created_at: new Date('2026-07-20T11:15:00Z').toISOString()
        }
      ],
      notifications: [],
      materials: [
        {
          id: 'mat_1',
          material_id: 'MAT-1001',
          material_name: 'PVC Cable',
          unit: 'm',
          current_stock: 100,
          created_at: new Date('2026-07-20T08:00:00Z').toISOString(),
          updated_at: new Date('2026-07-20T08:00:00Z').toISOString()
        },
        {
          id: 'mat_2',
          material_id: 'MAT-1002',
          material_name: 'Grease',
          unit: 'Tubes',
          current_stock: 50,
          created_at: new Date('2026-07-20T08:10:00Z').toISOString(),
          updated_at: new Date('2026-07-20T08:10:00Z').toISOString()
        },
        {
          id: 'mat_3',
          material_id: 'MAT-1003',
          material_name: 'Bearing',
          unit: 'pcs',
          current_stock: 30,
          created_at: new Date('2026-07-20T08:15:00Z').toISOString(),
          updated_at: new Date('2026-07-20T08:15:00Z').toISOString()
        }
      ],
      tools: [
        {
          id: 'tool_1',
          tool_id: 'TOOL-1001',
          tool_name: 'Multimeter',
          available_quantity: 5,
          created_at: new Date('2026-07-20T08:00:00Z').toISOString(),
          updated_at: new Date('2026-07-20T08:00:00Z').toISOString()
        },
        {
          id: 'tool_2',
          tool_id: 'TOOL-1002',
          tool_name: 'Clamp Meter',
          available_quantity: 3,
          created_at: new Date('2026-07-20T08:05:00Z').toISOString(),
          updated_at: new Date('2026-07-20T08:05:00Z').toISOString()
        },
        {
          id: 'tool_3',
          tool_id: 'TOOL-1003',
          tool_name: 'Bearing Puller',
          available_quantity: 2,
          created_at: new Date('2026-07-20T08:10:00Z').toISOString(),
          updated_at: new Date('2026-07-20T08:10:00Z').toISOString()
        },
        {
          id: 'tool_4',
          tool_id: 'TOOL-1004',
          tool_name: 'Torque Wrench',
          available_quantity: 4,
          created_at: new Date('2026-07-20T08:15:00Z').toISOString(),
          updated_at: new Date('2026-07-20T08:15:00Z').toISOString()
        }
      ],
      request_materials: [],
      request_tools: [],
      inventory_transactions: [],
      email_logs: []
    };
    this.saveLocal();
  }

  private saveLocal() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to write local database file', error);
    }
  }

  private saveToFirestore(colName: string, id: string, docData: any) {
    setDoc(doc(firestore, colName, String(id)), docData).catch(err => {
      console.error(`Error saving document ${id} to Firestore collection ${colName}:`, err);
    });
  }

  private deleteFromFirestore(colName: string, id: string) {
    deleteDoc(doc(firestore, colName, String(id))).catch(err => {
      console.error(`Error deleting document ${id} from Firestore collection ${colName}:`, err);
    });
  }

  // --- User Operations ---
  public getUsers(): User[] {
    this.ensureDataStructure();
    return this.data.users;
  }

  public findUserByEmail(email: string): User | undefined {
    this.ensureDataStructure();
    const sanitizedEmail = email.toLowerCase().trim();
    return this.data.users.find(u => u.email.toLowerCase() === sanitizedEmail);
  }

  public findUserById(id: string): User | undefined {
    this.ensureDataStructure();
    return this.data.users.find(u => u.id === id);
  }

  public createUser(user: Omit<User, 'id' | 'created_at'>): User {
    this.ensureDataStructure();
    const newUser: User = {
      ...user,
      id: 'u_' + Math.random().toString(36).substr(2, 9),
      email: user.email.toLowerCase().trim(),
      created_at: new Date().toISOString()
    };
    this.data.users.push(newUser);
    this.saveLocal();
    this.saveToFirestore('users', newUser.id, newUser);
    return newUser;
  }

  public setResetToken(email: string, token: string, expiresAt: string): boolean {
    this.ensureDataStructure();
    const user = this.findUserByEmail(email);
    if (!user) return false;
    user.reset_token = token;
    user.reset_token_expires = expiresAt;
    this.saveLocal();
    this.saveToFirestore('users', user.id, user);
    return true;
  }

  public findUserByResetToken(token: string): User | undefined {
    this.ensureDataStructure();
    return this.data.users.find(u => u.reset_token === token);
  }

  public resetUserPassword(userId: string, newPasswordHash: string): boolean {
    this.ensureDataStructure();
    const user = this.findUserById(userId);
    if (!user) return false;
    user.password = newPasswordHash;
    user.reset_token = undefined;
    user.reset_token_expires = undefined;
    this.saveLocal();
    this.saveToFirestore('users', user.id, user);
    return true;
  }

  // --- Request Operations ---
  public getRequests(): Request[] {
    this.ensureDataStructure();
    return this.data.requests;
  }

  public findRequestById(id: string): Request | undefined {
    this.ensureDataStructure();
    return this.data.requests.find(r => r.id === id);
  }

  public createRequest(req: Omit<Request, 'id' | 'created_at' | 'updated_at'>): Request {
    this.ensureDataStructure();
    const idNum = this.data.requests.length > 0 
      ? Math.max(...this.data.requests.map(r => {
          const parsed = parseInt(r.id.replace('req_', ''));
          return isNaN(parsed) ? 1000 : parsed;
        })) + 1
      : 1001;

    const newReq: Request = {
      ...req,
      id: `req_${idNum}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.data.requests.push(newReq);
    this.saveLocal();
    this.saveToFirestore('requests', newReq.id, newReq);
    return newReq;
  }

  public updateRequest(id: string, updates: Partial<Omit<Request, 'id' | 'created_at' | 'created_by'>>): Request | undefined {
    this.ensureDataStructure();
    const index = this.data.requests.findIndex(r => r.id === id);
    if (index === -1) return undefined;

    const updated: Request = {
      ...this.data.requests[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.data.requests[index] = updated;
    this.saveLocal();
    this.saveToFirestore('requests', updated.id, updated);
    return updated;
  }

  public deleteRequest(id: string): boolean {
    this.ensureDataStructure();
    const index = this.data.requests.findIndex(r => r.id === id);
    if (index === -1) return false;

    this.data.requests.splice(index, 1);
    this.deleteFromFirestore('requests', id);

    // Filter related logs, request materials, request tools
    const removedLogs = this.data.activity_logs.filter(log => log.request_id === id);
    this.data.activity_logs = this.data.activity_logs.filter(log => log.request_id !== id);
    removedLogs.forEach(l => this.deleteFromFirestore('activity_logs', l.id));

    const removedRm = this.data.request_materials.filter(rm => rm.request_id === id);
    this.data.request_materials = this.data.request_materials.filter(rm => rm.request_id !== id);
    removedRm.forEach(rm => this.deleteFromFirestore('request_materials', rm.id));

    const removedRt = this.data.request_tools.filter(rt => rt.request_id === id);
    this.data.request_tools = this.data.request_tools.filter(rt => rt.request_id !== id);
    removedRt.forEach(rt => this.deleteFromFirestore('request_tools', rt.id));

    this.saveLocal();
    return true;
  }

  // --- Activity Log Operations ---
  public getActivityLogs(requestId?: string): ActivityLog[] {
    this.ensureDataStructure();
    if (requestId) {
      return this.data.activity_logs.filter(log => log.request_id === requestId);
    }
    return this.data.activity_logs;
  }

  public clearActivityLogs(): boolean {
    this.ensureDataStructure();
    const oldLogs = [...this.data.activity_logs];
    this.data.activity_logs = [];
    this.saveLocal();
    oldLogs.forEach(l => this.deleteFromFirestore('activity_logs', l.id));
    return true;
  }

  public createActivityLog(log: Omit<ActivityLog, 'id' | 'created_at'>): ActivityLog {
    this.ensureDataStructure();
    const newLog: ActivityLog = {
      ...log,
      id: 'log_' + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString()
    };
    this.data.activity_logs.push(newLog);
    this.saveLocal();
    this.saveToFirestore('activity_logs', newLog.id, newLog);
    return newLog;
  }

  // --- Notification Operations ---
  public getNotifications(): Notification[] {
    this.ensureDataStructure();
    return this.data.notifications || [];
  }

  public createNotification(notif: Omit<Notification, 'id' | 'created_at' | 'read'>): Notification {
    this.ensureDataStructure();
    const newNotif: Notification = {
      ...notif,
      id: 'notif_' + Math.random().toString(36).substr(2, 9),
      read: false,
      created_at: new Date().toISOString()
    };
    this.data.notifications!.push(newNotif);
    this.saveLocal();
    this.saveToFirestore('notifications', newNotif.id, newNotif);
    return newNotif;
  }

  public markNotificationAsRead(id: string): boolean {
    this.ensureDataStructure();
    if (!this.data.notifications) return false;
    const notif = this.data.notifications.find(n => n.id === id);
    if (!notif) return false;
    notif.read = true;
    this.saveLocal();
    this.saveToFirestore('notifications', notif.id, notif);
    return true;
  }

  // --- Material Operations ---
  public getMaterials(): Material[] {
    this.ensureDataStructure();
    return this.data.materials;
  }

  public findMaterialById(id: string): Material | undefined {
    this.ensureDataStructure();
    return this.data.materials.find(m => m.id === id || m.material_id === id);
  }

  public createMaterial(mat: Omit<Material, 'id' | 'material_id' | 'created_at' | 'updated_at'>): Material {
    this.ensureDataStructure();

    const nextNum = this.data.materials.length > 0
      ? Math.max(...this.data.materials.map(m => {
          const parsed = parseInt((m.material_id || '').replace('MAT-', ''));
          return isNaN(parsed) ? 1000 : parsed;
        })) + 1
      : 1001;

    const newMat: Material = {
      ...mat,
      id: 'mat_' + Math.random().toString(36).substr(2, 9),
      material_id: `MAT-${nextNum}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.data.materials.push(newMat);
    this.saveLocal();
    this.saveToFirestore('materials', newMat.id, newMat);
    return newMat;
  }

  public updateMaterial(id: string, updates: Partial<Omit<Material, 'id' | 'material_id' | 'created_at'>>): Material | undefined {
    this.ensureDataStructure();
    const index = this.data.materials.findIndex(m => m.id === id || m.material_id === id);
    if (index === -1) return undefined;

    const updated: Material = {
      ...this.data.materials[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.data.materials[index] = updated;
    this.saveLocal();
    this.saveToFirestore('materials', updated.id, updated);
    return updated;
  }

  public deleteMaterial(id: string): boolean {
    this.ensureDataStructure();
    const index = this.data.materials.findIndex(m => m.id === id || m.material_id === id);
    if (index === -1) return false;

    const mat = this.data.materials[index];
    this.data.materials.splice(index, 1);
    this.saveLocal();
    this.deleteFromFirestore('materials', mat.id);
    return true;
  }

  // --- Tool Operations ---
  public getTools(): Tool[] {
    this.ensureDataStructure();
    return this.data.tools;
  }

  public findToolById(id: string): Tool | undefined {
    this.ensureDataStructure();
    return this.data.tools.find(t => t.id === id || t.tool_id === id);
  }

  public createTool(tool: Omit<Tool, 'id' | 'tool_id' | 'created_at' | 'updated_at'>): Tool {
    this.ensureDataStructure();

    const nextNum = this.data.tools.length > 0
      ? Math.max(...this.data.tools.map(t => {
          const parsed = parseInt((t.tool_id || '').replace('TOOL-', ''));
          return isNaN(parsed) ? 1000 : parsed;
        })) + 1
      : 1001;

    const newTool: Tool = {
      ...tool,
      id: 'tool_' + Math.random().toString(36).substr(2, 9),
      tool_id: `TOOL-${nextNum}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.data.tools.push(newTool);
    this.saveLocal();
    this.saveToFirestore('tools', newTool.id, newTool);
    return newTool;
  }

  public updateTool(id: string, updates: Partial<Omit<Tool, 'id' | 'tool_id' | 'created_at'>>): Tool | undefined {
    this.ensureDataStructure();
    const index = this.data.tools.findIndex(t => t.id === id || t.tool_id === id);
    if (index === -1) return undefined;

    const updated: Tool = {
      ...this.data.tools[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.data.tools[index] = updated;
    this.saveLocal();
    this.saveToFirestore('tools', updated.id, updated);
    return updated;
  }

  public deleteTool(id: string): boolean {
    this.ensureDataStructure();
    const index = this.data.tools.findIndex(t => t.id === id || t.tool_id === id);
    if (index === -1) return false;

    const tool = this.data.tools[index];
    this.data.tools.splice(index, 1);
    this.saveLocal();
    this.deleteFromFirestore('tools', tool.id);
    return true;
  }

  // --- Request Materials & Tools Operations ---
  public getRequestMaterialsByRequestId(requestId: string): RequestMaterial[] {
    this.ensureDataStructure();

    const reqMats = this.data.request_materials.filter(rm => rm.request_id === requestId);
    return reqMats.map(rm => {
      const mat = this.data.materials.find(m => m.id === rm.material_id || m.material_id === rm.material_id);
      return {
        ...rm,
        material_name: mat ? mat.material_name : 'Unknown Material',
        unit: mat ? mat.unit : '',
        current_stock: mat ? mat.current_stock : 0
      };
    });
  }

  public getRequestToolsByRequestId(requestId: string): RequestTool[] {
    this.ensureDataStructure();

    const reqTools = this.data.request_tools.filter(rt => rt.request_id === requestId);
    return reqTools.map(rt => {
      const tool = this.data.tools.find(t => t.id === rt.tool_id || t.tool_id === rt.tool_id);
      return {
        ...rt,
        tool_name: tool ? tool.tool_name : 'Unknown Tool',
        available_quantity: tool ? tool.available_quantity : 0
      };
    });
  }

  public assignMaterialsAndTools(
    requestId: string, 
    materials: { material_id: string; quantity: number }[], 
    tools: { tool_id: string; quantity: number }[],
    assignedBy: string
  ) {
    this.ensureDataStructure();

    // Clear previous assignments for this request
    const prevRm = this.data.request_materials.filter(rm => rm.request_id === requestId);
    const prevRt = this.data.request_tools.filter(rt => rt.request_id === requestId);

    prevRm.forEach(rm => this.deleteFromFirestore('request_materials', rm.id));
    prevRt.forEach(rt => this.deleteFromFirestore('request_tools', rt.id));

    this.data.request_materials = this.data.request_materials.filter(rm => rm.request_id !== requestId);
    this.data.request_tools = this.data.request_tools.filter(rt => rt.request_id !== requestId);

    materials.forEach(m => {
      const newRm: RequestMaterial = {
        id: 'rm_' + Math.random().toString(36).substr(2, 9),
        request_id: requestId,
        material_id: m.material_id,
        quantity: m.quantity,
        assigned_by: assignedBy,
        created_at: new Date().toISOString()
      };
      this.data.request_materials.push(newRm);
      this.saveToFirestore('request_materials', newRm.id, newRm);
    });

    tools.forEach(t => {
      const newRt: RequestTool = {
        id: 'rt_' + Math.random().toString(36).substr(2, 9),
        request_id: requestId,
        tool_id: t.tool_id,
        quantity: t.quantity,
        assigned_by: assignedBy,
        created_at: new Date().toISOString()
      };
      this.data.request_tools.push(newRt);
      this.saveToFirestore('request_tools', newRt.id, newRt);
    });

    this.saveLocal();
  }

  // --- Inventory Transactions ---
  public getInventoryTransactions(): InventoryTransaction[] {
    this.ensureDataStructure();
    return this.data.inventory_transactions;
  }

  public createInventoryTransaction(transaction: Omit<InventoryTransaction, 'id' | 'created_at'>): InventoryTransaction {
    this.ensureDataStructure();

    const newTx: InventoryTransaction = {
      ...transaction,
      id: 'tx_' + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString()
    };
    this.data.inventory_transactions.push(newTx);
    this.saveLocal();
    this.saveToFirestore('inventory_transactions', newTx.id, newTx);
    return newTx;
  }

  // --- Email Log Operations ---
  public getEmailLogs(): EmailLog[] {
    this.ensureDataStructure();
    return this.data.email_logs || [];
  }

  public createEmailLog(log: Omit<EmailLog, 'id' | 'created_at'>): EmailLog {
    this.ensureDataStructure();

    const newLog: EmailLog = {
      ...log,
      id: 'mail_' + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString()
    };
    this.data.email_logs!.push(newLog);
    this.saveLocal();
    this.saveToFirestore('email_logs', newLog.id, newLog);
    return newLog;
  }

  public clearEmailLogs(): boolean {
    this.ensureDataStructure();
    const oldLogs = [...(this.data.email_logs || [])];
    this.data.email_logs = [];
    this.saveLocal();
    oldLogs.forEach(l => this.deleteFromFirestore('email_logs', l.id));
    return true;
  }
}

export const db = new Database();
