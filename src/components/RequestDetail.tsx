import React, { useState, useEffect } from 'react';
import { Request, ActivityLog, RequestStatus, Material, Tool, RequestMaterial, RequestTool } from '../types';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Trash2, 
  Send, 
  CornerDownRight, 
  Calendar, 
  User, 
  MessageSquare,
  AlertCircle,
  Package,
  Wrench,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RequestDetailProps {
  request: Request;
  role: 'User' | 'Inventory Officer' | 'Admin';
  onStatusChange: (id: string, nextStatus: RequestStatus, comments: string) => Promise<void>;
  onAddComment: (id: string, comments: string) => Promise<void>;
  onDeleteRequest: (id: string) => Promise<void>;
  onComplete?: (id: string) => Promise<void>;
  onRefreshData?: () => void;
}

export default function RequestDetail({
  request,
  role,
  onStatusChange,
  onAddComment,
  onDeleteRequest,
  onComplete,
  onRefreshData
}: RequestDetailProps) {
  const [timeline, setTimeline] = useState<ActivityLog[]>([]);
  const [assignedMaterials, setAssignedMaterials] = useState<RequestMaterial[]>([]);
  const [assignedTools, setAssignedTools] = useState<RequestTool[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  
  // Inventory Officer Assignment States
  const [availableMaterials, setAvailableMaterials] = useState<Material[]>([]);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<{ material_id: string; quantity: number }[]>([]);
  const [selectedTools, setSelectedTools] = useState<{ tool_id: string; quantity: number }[]>([]);

  const [commentText, setCommentText] = useState('');
  const [adminCommentText, setAdminCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Fetch timeline and assigned materials/tools
  const fetchDetails = async () => {
    setLoadingTimeline(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/requests/${request.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTimeline(data.timeline || []);
        setAssignedMaterials(data.assigned_materials || []);
        setAssignedTools(data.assigned_tools || []);
      } else {
        setError(data.message || 'Failed to fetch request details');
      }
    } catch (err) {
      setError('Connection error fetching details.');
    } finally {
      setLoadingTimeline(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [request.id]);

  // Fetch inventory for Inventory Officer review console
  useEffect(() => {
    if (role === 'Inventory Officer' || role === 'Admin') {
      const token = localStorage.getItem('token');
      fetch('/api/inventory/materials', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setAvailableMaterials(data.materials || []))
        .catch(err => console.error(err));

      fetch('/api/inventory/tools', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setAvailableTools(data.tools || []))
        .catch(err => console.error(err));
    }
  }, [role, request.id]);

  const handleAssignMaterialsAndTools = async () => {
    setError('');
    if (selectedMaterials.length === 0 && selectedTools.length === 0) {
      setError('Validation Error: You must assign at least ONE Material OR at least ONE Tool before submitting to Admin.');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/requests/${request.id}/assign-materials-tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          materials: selectedMaterials,
          tools: selectedTools
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to assign materials and tools');
      }
      setSelectedMaterials([]);
      setSelectedTools([]);
      if (onRefreshData) onRefreshData();
      fetchDetails();
    } catch (err: any) {
      setError(err.message || 'Assignment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusAction = async (nextStatus: RequestStatus) => {
    setError('');
    
    if (!adminCommentText.trim()) {
      setError(`A comment/reason is required to set status to ${nextStatus}.`);
      return;
    }

    setSubmitting(true);
    try {
      await onStatusChange(request.id, nextStatus, adminCommentText.trim());
      setAdminCommentText('');
      if (onRefreshData) onRefreshData();
      fetchDetails();
    } catch (err: any) {
      setError(err.message || 'Status transition failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCommentAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setError('');
    setSubmitting(true);
    try {
      await onAddComment(request.id, commentText.trim());
      setCommentText('');
      fetchDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to submit comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAction = async () => {
    setSubmitting(true);
    try {
      await onDeleteRequest(request.id);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      setError(err.message || 'Deletion failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }) + ' ' + date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  const getTimelineIcon = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('submitted')) return <Clock className="w-4 h-4 text-blue-300" />;
    if (act.includes('approved')) return <CheckCircle className="w-4 h-4 text-emerald-300" />;
    if (act.includes('rejected')) return <XCircle className="w-4 h-4 text-rose-300" />;
    if (act.includes('inventory')) return <Package className="w-4 h-4 text-amber-300" />;
    if (act.includes('comment')) return <MessageSquare className="w-4 h-4 text-indigo-300" />;
    return <Clock className="w-4 h-4 text-slate-300" />;
  };

  return (
    <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/20 rounded-[28px] shadow-2xl p-6 space-y-6 overflow-y-auto max-h-[850px] text-slate-100">
      {/* Detail Header */}
      <div className="border-b border-white/15 pb-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-blue-300 bg-blue-500/20 border border-blue-400/30 px-2.5 py-1 rounded-xl backdrop-blur-md">
            {request.id}
          </span>
          <span className="text-xs text-slate-300 font-medium flex items-center">
            <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" />
            {formatDate(request.created_at)}
          </span>
        </div>
        <h2 className="text-xl font-extrabold text-white mt-3 tracking-tight drop-shadow-sm">
          {request.title}
        </h2>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-xs text-slate-200 bg-white/10 border border-white/20 px-3 py-1 rounded-full font-semibold backdrop-blur-md">
            Dept: {request.department}
          </span>
          <span className="text-xs text-slate-200 bg-white/10 border border-white/20 px-3 py-1 rounded-full font-semibold backdrop-blur-md">
            Priority: {request.priority}
          </span>
          <span className="text-xs font-extrabold text-blue-200 bg-blue-500/20 border border-blue-400/30 px-3 py-1 rounded-full backdrop-blur-md">
            Status: {request.status}
          </span>
        </div>
      </div>

      {/* Description */}
      <div>
        <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-2">Problem Description</h3>
        <p className="text-xs text-slate-200 leading-relaxed bg-white/10 border border-white/15 p-4 rounded-2xl whitespace-pre-line backdrop-blur-md shadow-inner">
          {request.description}
        </p>
      </div>

      {/* Attachment link if exists */}
      {request.attachment && (
        <div className="bg-white/10 border border-white/15 p-3 rounded-2xl text-xs backdrop-blur-md">
          <span className="font-bold text-white">Attachment: </span>
          <a href={request.attachment} target="_blank" rel="noreferrer" className="text-blue-300 underline font-mono">
            {request.attachment}
          </a>
        </div>
      )}

      {/* Assigned Materials and Tools (VISIBLE ONLY TO INVENTORY OFFICER AND ADMIN) */}
      {role !== 'User' && (assignedMaterials.length > 0 || assignedTools.length > 0) && (
        <div className="bg-white/10 border border-white/15 p-4 rounded-2xl space-y-4 backdrop-blur-md shadow-inner">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center">
            <Package className="h-4 w-4 mr-1.5 text-blue-400" />
            Assigned Materials & Tools
          </h4>

          {assignedMaterials.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Materials</span>
              {assignedMaterials.map((m) => (
                <div key={m.id} className="bg-slate-900/60 border border-white/15 p-3 rounded-2xl flex justify-between text-xs items-center">
                  <span className="font-semibold text-white">{m.material_name} ({m.material_id})</span>
                  <span className="font-mono font-bold text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded-lg border border-blue-400/30">{m.quantity} {m.unit}</span>
                </div>
              ))}
            </div>
          )}

          {assignedTools.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Tools</span>
              {assignedTools.map((t) => (
                <div key={t.id} className="bg-slate-900/60 border border-white/15 p-3 rounded-2xl flex justify-between text-xs items-center">
                  <span className="font-semibold text-white">{t.tool_name} ({t.tool_id})</span>
                  <span className="font-mono font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-lg border border-indigo-400/30">Qty: {t.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inventory Officer Workflow: Assign Materials & Tools */}
      {role === 'Inventory Officer' && request.status === 'Pending Inventory Review' && (
        <div className="bg-amber-500/15 border border-amber-400/30 p-5 rounded-2xl space-y-4 backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <Wrench className="h-5 w-5 text-amber-300" />
            <h3 className="text-xs font-bold text-amber-200 uppercase tracking-wider">
              Inventory Review: Assign Materials & Tools
            </h3>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            You must assign <strong className="text-amber-200">at least ONE Material OR at least ONE Tool</strong> from inventory before submitting this request to Admin for approval.
          </p>

          {/* Material Assignment */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-200">Assign Materials</label>
            {selectedMaterials.map((m, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  value={m.material_id}
                  onChange={(e) => {
                    const next = [...selectedMaterials];
                    next[idx].material_id = e.target.value;
                    setSelectedMaterials(next);
                  }}
                  className="flex-1 border border-white/20 rounded-xl p-2.5 text-xs bg-slate-900 text-white font-medium"
                >
                  <option value="">Select Material...</option>
                  {availableMaterials.map(mat => (
                    <option key={mat.id} value={mat.id}>
                      {mat.material_name} (Stock: {mat.current_stock} {mat.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={m.quantity}
                  onChange={(e) => {
                    const next = [...selectedMaterials];
                    next[idx].quantity = parseInt(e.target.value) || 1;
                    setSelectedMaterials(next);
                  }}
                  className="w-20 border border-white/20 rounded-xl p-2.5 text-xs font-mono bg-slate-900 text-white"
                />
                <button
                  type="button"
                  onClick={() => setSelectedMaterials(selectedMaterials.filter((_, i) => i !== idx))}
                  className="text-rose-400 p-2 hover:bg-white/10 rounded-xl transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSelectedMaterials([...selectedMaterials, { material_id: '', quantity: 1 }])}
              className="flex items-center text-xs font-bold text-amber-300 hover:text-amber-200"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Material
            </button>
          </div>

          {/* Tool Assignment */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-200">Assign Tools</label>
            {selectedTools.map((t, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  value={t.tool_id}
                  onChange={(e) => {
                    const next = [...selectedTools];
                    next[idx].tool_id = e.target.value;
                    setSelectedTools(next);
                  }}
                  className="flex-1 border border-white/20 rounded-xl p-2.5 text-xs bg-slate-900 text-white font-medium"
                >
                  <option value="">Select Tool...</option>
                  {availableTools.map(tool => (
                    <option key={tool.id} value={tool.id}>
                      {tool.tool_name} (Status: {tool.status})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={t.quantity}
                  onChange={(e) => {
                    const next = [...selectedTools];
                    next[idx].quantity = parseInt(e.target.value) || 1;
                    setSelectedTools(next);
                  }}
                  className="w-20 border border-white/20 rounded-xl p-2.5 text-xs font-mono bg-slate-900 text-white"
                />
                <button
                  type="button"
                  onClick={() => setSelectedTools(selectedTools.filter((_, i) => i !== idx))}
                  className="text-rose-400 p-2 hover:bg-white/10 rounded-xl transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSelectedTools([...selectedTools, { tool_id: '', quantity: 1 }])}
              className="flex items-center text-xs font-bold text-amber-300 hover:text-amber-200"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Tool
            </button>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={handleAssignMaterialsAndTools}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl text-xs font-extrabold transition shadow-lg cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Request to Admin for Approval'}
          </button>
        </div>
      )}

      {/* Requester Info */}
      <div className="flex items-center space-x-3 bg-white/10 p-3.5 rounded-2xl border border-white/15 backdrop-blur-md">
        <div className="h-9 w-9 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 font-semibold">
          <User className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Submitted By</p>
          <p className="text-xs font-bold text-white">{request.creator_name} ({request.creator_email})</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/40 p-4 rounded-2xl flex items-start space-x-2.5 text-red-100 text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-300 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Admin Actions Console */}
      {role === 'Admin' && request.status !== 'Completed' && (
        <div className="bg-white/10 p-5 rounded-2xl border border-white/15 space-y-4 backdrop-blur-md">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center">
            <CornerDownRight className="h-4 w-4 mr-1.5 text-blue-400" />
            Admin Action Console
          </h3>
          
          <textarea
            id="admin_comment_input"
            value={adminCommentText}
            onChange={(e) => setAdminCommentText(e.target.value)}
            placeholder="Add comments, details, or reasons here... (Required for approving, rejecting, or requesting more info)"
            rows={3}
            className="block w-full border border-white/20 rounded-2xl p-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 text-xs transition bg-slate-900/60 backdrop-blur-md"
          />

          <div className="grid grid-cols-3 gap-2">
            <button
              id="btn_approve"
              type="button"
              disabled={submitting}
              onClick={() => handleStatusAction('Approved')}
              className="flex items-center justify-center py-2.5 px-3 border border-emerald-400/30 rounded-2xl shadow-lg text-xs font-bold text-white bg-emerald-600/80 hover:bg-emerald-600 active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Approve
            </button>
            <button
              id="btn_reject"
              type="button"
              disabled={submitting}
              onClick={() => handleStatusAction('Rejected')}
              className="flex items-center justify-center py-2.5 px-3 border border-rose-400/30 rounded-2xl shadow-lg text-xs font-bold text-white bg-rose-600/80 hover:bg-rose-600 active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Reject
            </button>
            <button
              id="btn_need_info"
              type="button"
              disabled={submitting}
              onClick={() => handleStatusAction('Need More Information')}
              className="flex items-center justify-center py-2.5 px-3 border border-indigo-400/30 rounded-2xl shadow-lg text-xs font-bold text-white bg-indigo-600/80 hover:bg-indigo-600 active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              Need Info
            </button>
          </div>

          <div className="border-t border-white/15 pt-4">
            {!showDeleteConfirm ? (
              <button
                id="btn_delete_confirm_toggle"
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center py-2 px-3 border border-rose-400/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-2xl text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete Request File
              </button>
            ) : (
              <div className="bg-red-950/60 border border-red-500/40 p-4 rounded-2xl space-y-3">
                <p className="text-red-200 text-xs font-medium">Are you sure? This deletes the request and all timeline logs permanently.</p>
                <div className="flex space-x-2">
                  <button
                    id="btn_delete_request"
                    type="button"
                    disabled={submitting}
                    onClick={handleDeleteAction}
                    className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Yes, Delete
                  </button>
                  <button
                    id="btn_delete_cancel"
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 px-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Actions - Confirm Work Completed */}
      {role === 'User' && request.status === 'Approved' && (
        <div className="bg-emerald-500/15 p-5 rounded-2xl border border-emerald-400/30 space-y-4 backdrop-blur-md">
          <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center">
            <CheckCircle className="h-4 w-4 mr-1.5 text-emerald-400" />
            Confirm Work Completion
          </h3>
          <p className="text-xs text-slate-200 leading-normal">
            Your request has been approved. Once the work is completed, please click below to confirm.
          </p>
          <button
            id="btn_work_completed"
            type="button"
            onClick={() => setShowCompleteConfirm(true)}
            className="w-full flex items-center justify-center py-3 px-4 rounded-2xl shadow-lg text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 transition cursor-pointer active:scale-95 border border-white/20"
          >
            <CheckCircle className="h-4 w-4 mr-1.5" />
            Confirm Work Completed
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {showCompleteConfirm && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900/90 rounded-3xl shadow-2xl border border-white/20 max-w-md w-full p-6 space-y-4 font-sans backdrop-blur-2xl"
            >
              <div className="flex items-center space-x-3 text-emerald-400">
                <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-extrabold text-white">Confirm Work Completion</h3>
              </div>
              
              <p className="text-slate-200 text-xs leading-relaxed">
                Has your requested work been completed successfully?
              </p>

              <div className="flex space-x-3 pt-2">
                <button
                  id="btn_confirm_complete_cancel"
                  type="button"
                  onClick={() => setShowCompleteConfirm(false)}
                  className="flex-1 py-2.5 px-4 border border-white/20 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn_confirm_complete_confirm"
                  type="button"
                  disabled={submitting}
                  onClick={async () => {
                    if (onComplete) {
                      setSubmitting(true);
                      setError('');
                      try {
                        await onComplete(request.id);
                        setShowCompleteConfirm(false);
                      } catch (err: any) {
                        setError(err.message || 'Failed to complete request');
                      } finally {
                        setSubmitting(false);
                      }
                    }
                  }}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-white rounded-2xl text-xs font-bold transition cursor-pointer shadow-lg shadow-emerald-600/30 border border-white/20"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Comment Form */}
      <form onSubmit={handleAddCommentAction} className="flex items-center space-x-2">
        <input
          id="general_comment_input"
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment to the activity log..."
          className="block flex-1 border border-white/20 rounded-2xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 text-xs transition bg-white/10 hover:bg-white/15 backdrop-blur-md"
        />
        <button
          id="btn_add_comment"
          type="submit"
          disabled={submitting || !commentText.trim()}
          className="p-3 border border-white/20 rounded-2xl shadow-lg text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition cursor-pointer active:scale-95"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {/* Activity Timeline */}
      <div className="border-t border-white/15 pt-5">
        <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-4">Activity Timeline</h3>
        
        {loadingTimeline ? (
          <p className="text-xs text-slate-400 italic">Loading activity logs...</p>
        ) : (
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-white/15" />

            {timeline.map((log) => (
              <div key={log.id} className="relative flex items-start space-x-3 text-xs">
                <div className="absolute -left-6 mt-1 flex items-center justify-center h-5 w-5 bg-slate-900 border border-white/30 rounded-full">
                  {getTimelineIcon(log.action)}
                </div>

                <div className="flex-1 bg-white/10 p-3.5 rounded-2xl border border-white/15 backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{log.action}</span>
                    <span className="text-[10px] text-slate-300 font-medium">{formatDate(log.created_at)}</span>
                  </div>
                  <p className="text-slate-200 mt-1 leading-relaxed text-xs">{log.description}</p>
                  <p className="text-[10px] text-blue-300 font-semibold mt-1.5">
                    By: {log.performed_by} ({log.role})
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


