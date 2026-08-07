import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  Wrench, 
  History, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  X, 
  RefreshCw
} from 'lucide-react';
import { Material, Tool, InventoryTransaction } from '../types';

interface AdminInventoryModuleProps {
  token: string;
  triggerToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  userRole?: string;
  readOnly?: boolean;
}

export default function AdminInventoryModule({ token, triggerToast, userRole, readOnly }: AdminInventoryModuleProps) {
  const isReadOnly = readOnly || userRole === 'Admin';
  const [activeTab, setActiveTab] = useState<'materials' | 'tools' | 'transactions'>('materials');
  
  // Data states
  const [materials, setMaterials] = useState<Material[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals and Forms
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  
  // Material Form
  const [matName, setMatName] = useState('');
  const [matUnit, setMatUnit] = useState('pcs');
  const [matCurrentStock, setMatCurrentStock] = useState('0');
  const [matMinStock, setMatMinStock] = useState('0');
  const [matSupplier, setMatSupplier] = useState('');
  const [matLocation, setMatLocation] = useState('');
  const [matDescription, setMatDescription] = useState('');

  // Tool Form
  const [showToolModal, setShowToolModal] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [toolName, setToolName] = useState('');
  const [toolSerial, setToolSerial] = useState('');
  const [toolCategory, setToolCategory] = useState('Hand Tools');
  const [toolStatus, setToolStatus] = useState<'Available' | 'In Use' | 'Under Maintenance'>('Available');
  const [toolLocation, setToolLocation] = useState('');
  const [toolDescription, setToolDescription] = useState('');

  // Delete Confirm State
  const [deletingId, setDeletingId] = useState<{ id: string; type: 'material' | 'tool' } | null>(null);

  // Fetch Materials
  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/materials?search=${encodeURIComponent(searchQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMaterials(data.materials || []);
      } else {
        triggerToast(data.message || 'Failed to fetch materials', 'error');
      }
    } catch (err) {
      triggerToast('Error connecting to inventory service', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, searchQuery, triggerToast]);

  // Fetch Tools
  const fetchTools = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/tools?search=${encodeURIComponent(searchQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTools(data.tools || []);
      } else {
        triggerToast(data.message || 'Failed to fetch tools', 'error');
      }
    } catch (err) {
      triggerToast('Error connecting to inventory service', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, searchQuery, triggerToast]);

  // Fetch Transactions History
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory/transactions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'materials') fetchMaterials();
    else if (activeTab === 'tools') fetchTools();
    else fetchTransactions();
  }, [activeTab, searchQuery, fetchMaterials, fetchTools, fetchTransactions]);

  // Handle Material Submit
  const handleMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matName.trim()) {
      triggerToast('Material name is required', 'error');
      return;
    }

    const payload = {
      material_name: matName.trim(),
      unit: matUnit.trim(),
      current_stock: parseInt(matCurrentStock) || 0,
      minimum_stock_level: parseInt(matMinStock) || 0,
      supplier: matSupplier.trim(),
      location: matLocation.trim(),
      description: matDescription.trim()
    };

    try {
      const url = editingMaterial ? `/api/inventory/materials/${editingMaterial.id}` : '/api/inventory/materials';
      const method = editingMaterial ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        triggerToast(editingMaterial ? 'Material updated successfully!' : 'Material created successfully!', 'success');
        setShowMaterialModal(false);
        fetchMaterials();
      } else {
        triggerToast(data.message || 'Failed to save material', 'error');
      }
    } catch (err) {
      triggerToast('Server connection error saving material', 'error');
    }
  };

  // Handle Tool Submit
  const handleToolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolName.trim()) {
      triggerToast('Tool name is required', 'error');
      return;
    }

    const payload = {
      tool_name: toolName.trim(),
      serial_number: toolSerial.trim(),
      category: toolCategory.trim(),
      status: toolStatus,
      location: toolLocation.trim(),
      description: toolDescription.trim()
    };

    try {
      const url = editingTool ? `/api/inventory/tools/${editingTool.id}` : '/api/inventory/tools';
      const method = editingTool ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        triggerToast(editingTool ? 'Tool updated successfully!' : 'Tool created successfully!', 'success');
        setShowToolModal(false);
        fetchTools();
      } else {
        triggerToast(data.message || 'Failed to save tool', 'error');
      }
    } catch (err) {
      triggerToast('Server connection error saving tool', 'error');
    }
  };

  // Delete Item
  const handleDeleteItem = async () => {
    if (!deletingId) return;
    try {
      const endpoint = deletingId.type === 'material' 
        ? `/api/inventory/materials/${deletingId.id}`
        : `/api/inventory/tools/${deletingId.id}`;

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok) {
        triggerToast(`${deletingId.type === 'material' ? 'Material' : 'Tool'} deleted successfully.`, 'success');
        setDeletingId(null);
        if (activeTab === 'materials') fetchMaterials();
        else fetchTools();
      } else {
        triggerToast(data.message || 'Failed to delete item', 'error');
      }
    } catch (err) {
      triggerToast('Server connection error deleting item', 'error');
    }
  };

  return (
    <div id="inventory_module_root" className="space-y-6 font-sans text-slate-100">
      
      {/* Top Header & Navigation */}
      <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/20 rounded-[28px] p-6 shadow-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-500/20 border border-blue-400/30 rounded-2xl text-blue-300 shadow-inner">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight drop-shadow-sm">Inventory & Stock</h1>
              {isReadOnly && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-400/40 uppercase tracking-wider">
                  View Only Mode (Admin)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300">
              {isReadOnly 
                ? 'Read-only overview: view materials, tools, stock levels, and transaction logs.' 
                : 'Manage materials, tools, stock levels, and audit transactions.'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border border-white/20 rounded-2xl p-1.5 bg-slate-950/60 backdrop-blur-md shrink-0 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('materials')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'materials'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 border border-white/20'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            <span>Materials</span>
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'tools'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-white/20'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>Tools</span>
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'transactions'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 border border-white/20'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Transactions</span>
          </button>
        </div>
      </div>

      {/* Materials Tab */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search materials by name, code, supplier..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 backdrop-blur-md border border-white/20 rounded-2xl text-xs font-medium text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-400/50 outline-none"
              />
            </div>
            {!isReadOnly && (
              <button
                onClick={() => {
                  setEditingMaterial(null);
                  setMatName('');
                  setMatUnit('pcs');
                  setMatCurrentStock('0');
                  setMatMinStock('0');
                  setMatSupplier('');
                  setMatLocation('');
                  setMatDescription('');
                  setShowMaterialModal(true);
                }}
                className="flex items-center justify-center space-x-1.5 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-600/30 border border-white/20 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Material</span>
              </button>
            )}
          </div>

          <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/20 rounded-[24px] shadow-2xl overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-300">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-400" />
                <p className="text-xs font-medium">Loading materials...</p>
              </div>
            ) : materials.length === 0 ? (
              <div className="p-12 text-center text-slate-300">
                <Package className="h-10 w-10 mx-auto mb-2 text-slate-400" />
                <p className="text-xs font-semibold">No materials found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-white/10 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                      <th className="py-3.5 px-5">Material Name</th>
                      <th className="py-3.5 px-4">Location</th>
                      <th className="py-3.5 px-4">Supplier</th>
                      <th className="py-3.5 px-4 text-center">Unit</th>
                      <th className="py-3.5 px-4 text-center">Current Stock</th>
                      <th className="py-3.5 px-4 text-center">Min Stock</th>
                      {!isReadOnly && <th className="py-3.5 px-5 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-xs">
                    {materials.map((item) => {
                      const isLowStock = item.current_stock <= item.minimum_stock_level;
                      return (
                        <tr key={item.id} className="hover:bg-white/5 transition">
                          <td className="py-3.5 px-5 font-semibold text-white">
                            {item.material_name}
                            {isLowStock && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-200 border border-rose-400/40 uppercase">
                                Low Stock
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">{item.location || 'N/A'}</td>
                          <td className="py-3.5 px-4 text-slate-300">{item.supplier || 'N/A'}</td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-300">{item.unit}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full font-bold font-mono text-xs border ${isLowStock ? 'bg-rose-500/20 text-rose-200 border-rose-400/40' : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'}`}>
                              {item.current_stock}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-slate-300 font-bold">{item.minimum_stock_level}</td>
                          {!isReadOnly && (
                            <td className="py-3.5 px-5 text-right">
                              <div className="flex justify-end space-x-1">
                                <button
                                  onClick={() => {
                                    setEditingMaterial(item);
                                    setMatName(item.material_name);
                                    setMatUnit(item.unit);
                                    setMatCurrentStock((item.current_stock ?? 0).toString());
                                    setMatMinStock((item.minimum_stock_level ?? 0).toString());
                                    setMatSupplier(item.supplier || '');
                                    setMatLocation(item.location || '');
                                    setMatDescription(item.description || '');
                                    setShowMaterialModal(true);
                                  }}
                                  className="p-1.5 text-slate-300 hover:text-blue-400 rounded-lg hover:bg-white/10 transition cursor-pointer"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setDeletingId({ id: item.id, type: 'material' })}
                                  className="p-1.5 text-slate-300 hover:text-rose-400 rounded-lg hover:bg-white/10 transition cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tools Tab */}
      {activeTab === 'tools' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools by name, category, status..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 backdrop-blur-md border border-white/20 rounded-2xl text-xs font-medium text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-400/50 outline-none"
              />
            </div>
            {!isReadOnly && (
              <button
                onClick={() => {
                  setEditingTool(null);
                  setToolName('');
                  setToolSerial('');
                  setToolCategory('Hand Tools');
                  setToolStatus('Available');
                  setToolLocation('');
                  setToolDescription('');
                  setShowToolModal(true);
                }}
                className="flex items-center justify-center space-x-1.5 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-600/30 border border-white/20 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Tool</span>
              </button>
            )}
          </div>

          <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/20 rounded-[24px] shadow-2xl overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-300">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-400" />
                <p className="text-xs font-medium">Loading tools...</p>
              </div>
            ) : tools.length === 0 ? (
              <div className="p-12 text-center text-slate-300">
                <Wrench className="h-10 w-10 mx-auto mb-2 text-slate-400" />
                <p className="text-xs font-semibold">No tools found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-white/10 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                      <th className="py-3.5 px-5">Tool Name</th>
                      <th className="py-3.5 px-4">Serial Number</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4">Location</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      {!isReadOnly && <th className="py-3.5 px-5 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-xs">
                    {tools.map((tool) => (
                      <tr key={tool.id} className="hover:bg-white/5 transition">
                        <td className="py-3.5 px-5 font-semibold text-white">{tool.tool_name}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">{tool.serial_number || 'N/A'}</td>
                        <td className="py-3.5 px-4 text-slate-300">{tool.category}</td>
                        <td className="py-3.5 px-4 text-slate-300">{tool.location || 'N/A'}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                            tool.status === 'Available' ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' :
                            tool.status === 'In Use' ? 'bg-blue-500/20 text-blue-200 border-blue-400/40' :
                            'bg-amber-500/20 text-amber-200 border-amber-400/40'
                          }`}>
                            {tool.status}
                          </span>
                        </td>
                        {!isReadOnly && (
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex justify-end space-x-1">
                              <button
                                onClick={() => {
                                  setEditingTool(tool);
                                  setToolName(tool.tool_name);
                                  setToolSerial(tool.serial_number || '');
                                  setToolCategory(tool.category || 'Hand Tools');
                                  setToolStatus(tool.status);
                                  setToolLocation(tool.location || '');
                                  setToolDescription(tool.description || '');
                                  setShowToolModal(true);
                                }}
                                className="p-1.5 text-slate-300 hover:text-indigo-400 rounded-lg hover:bg-white/10 transition cursor-pointer"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeletingId({ id: tool.id, type: 'tool' })}
                                className="p-1.5 text-slate-300 hover:text-rose-400 rounded-lg hover:bg-white/10 transition cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/20 rounded-[24px] shadow-2xl overflow-hidden">
            {transactions.length === 0 ? (
              <div className="p-12 text-center text-slate-300">
                <History className="h-10 w-10 mx-auto mb-2 text-slate-400" />
                <p className="text-xs font-semibold">No stock transactions logged yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-white/10 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                      <th className="py-3.5 px-5">Date</th>
                      <th className="py-3.5 px-4">Request ID</th>
                      <th className="py-3.5 px-4">Item Name</th>
                      <th className="py-3.5 px-4 text-center">Type</th>
                      <th className="py-3.5 px-4 text-center">Qty</th>
                      <th className="py-3.5 px-5">Performed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/5 transition">
                        <td className="py-3.5 px-5 text-slate-300 font-medium">{new Date(tx.created_at).toLocaleString()}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-400">{tx.request_id || 'N/A'}</td>
                        <td className="py-3.5 px-4 font-semibold text-white">{tx.item_name}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${tx.type === 'Stock Out' ? 'bg-rose-500/20 text-rose-200 border-rose-400/40' : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-white">{tx.quantity}</td>
                        <td className="py-3.5 px-5 text-slate-200">{tx.performed_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/20 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-white">
            <h3 className="text-base font-bold text-white">Confirm Deletion</h3>
            <p className="text-xs text-slate-300 mt-2">Are you sure you want to delete this {deletingId.type}? Operations cannot be undone.</p>
            <div className="flex justify-end space-x-2 mt-5">
              <button onClick={() => setDeletingId(null)} className="px-3.5 py-2 border border-white/20 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/10">Cancel</button>
              <button onClick={handleDeleteItem} className="px-3.5 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Material Modal */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/20 rounded-2xl max-w-md w-full p-6 shadow-2xl text-white">
            <div className="flex justify-between items-center pb-3 border-b border-white/15">
              <h3 className="text-sm font-bold text-white">{editingMaterial ? 'Edit Material' : 'Add Material'}</h3>
              <button onClick={() => setShowMaterialModal(false)}><X className="h-4 w-4 text-slate-300 hover:text-white" /></button>
            </div>
            <form onSubmit={handleMaterialSubmit} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">Material Name *</label>
                <input required type="text" value={matName} onChange={e => setMatName(e.target.value)} className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-2.5 text-xs text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-400/50" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">Unit *</label>
                  <input required type="text" value={matUnit} onChange={e => setMatUnit(e.target.value)} className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-blue-400/50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">Current Stock</label>
                  <input required type="number" value={matCurrentStock} onChange={e => setMatCurrentStock(e.target.value)} className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-blue-400/50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">Min Stock</label>
                  <input required type="number" value={matMinStock} onChange={e => setMatMinStock(e.target.value)} className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-blue-400/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">Location</label>
                  <input type="text" value={matLocation} onChange={e => setMatLocation(e.target.value)} className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-blue-400/50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">Supplier</label>
                  <input type="text" value={matSupplier} onChange={e => setMatSupplier(e.target.value)} className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-blue-400/50" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">Description</label>
                <textarea value={matDescription} onChange={e => setMatDescription(e.target.value)} className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-blue-400/50" rows={2} />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-white/15">
                <button type="button" onClick={() => setShowMaterialModal(false)} className="px-3.5 py-2 border border-white/20 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/10">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tool Modal */}
      {showToolModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/20 rounded-2xl max-w-md w-full p-6 shadow-2xl text-white">
            <div className="flex justify-between items-center pb-3 border-b border-white/15">
              <h3 className="text-sm font-bold text-white">{editingTool ? 'Edit Tool' : 'Add Tool'}</h3>
              <button onClick={() => setShowToolModal(false)}><X className="h-4 w-4 text-slate-300 hover:text-white" /></button>
            </div>
            <form onSubmit={handleToolSubmit} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">Tool Name *</label>
                <input required type="text" value={toolName} onChange={e => setToolName(e.target.value)} className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-400/50" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">Serial Number</label>
                  <input type="text" value={toolSerial} onChange={e => setToolSerial(e.target.value)} className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-400/50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">Category</label>
                  <input type="text" value={toolCategory} onChange={e => setToolCategory(e.target.value)} className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-400/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">Status</label>
                  <select value={toolStatus} onChange={e => setToolStatus(e.target.value as any)} className="w-full bg-slate-950 border border-white/20 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-400/50">
                    <option value="Available" className="bg-slate-900 text-white">Available</option>
                    <option value="In Use" className="bg-slate-900 text-white">In Use</option>
                    <option value="Under Maintenance" className="bg-slate-900 text-white">Under Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">Location</label>
                  <input type="text" value={toolLocation} onChange={e => setToolLocation(e.target.value)} className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-400/50" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">Description</label>
                <textarea value={toolDescription} onChange={e => setToolDescription(e.target.value)} className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-400/50" rows={2} />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-white/15">
                <button type="button" onClick={() => setShowToolModal(false)} className="px-3.5 py-2 border border-white/20 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/10">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
