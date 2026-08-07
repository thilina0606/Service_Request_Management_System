import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, FileText, AlertCircle, Paperclip } from 'lucide-react';
import { RequestDepartment, RequestPriority, ALL_DEPARTMENTS } from '../types';

interface RequestModalProps {
  onClose: () => void;
  onSubmit: (data: { 
    title: string; 
    department: RequestDepartment; 
    description: string; 
    priority: RequestPriority;
    attachment?: string;
  }) => Promise<void>;
}

export default function RequestModal({ onClose, onSubmit }: RequestModalProps) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState<string>(''); // Default blank for "Select Department"
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<RequestPriority>('Medium');
  const [attachment, setAttachment] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    if (!department || !ALL_DEPARTMENTS.includes(department as any)) {
      setError('Please select a valid department.');
      return;
    }

    if (!description.trim()) {
      setError('Problem description is required.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        department: department as RequestDepartment,
        description: description.trim(),
        priority,
        attachment: attachment.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="modal_overlay" className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative bg-slate-900/80 backdrop-blur-2xl rounded-[32px] shadow-2xl border border-white/20 max-w-xl w-full overflow-hidden text-white"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/15 bg-white/5">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-500/20 border border-blue-400/30 text-blue-300 rounded-2xl">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">Create Service Request</h3>
          </div>
          <button
            id="btn_modal_close"
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-white/10 p-2 rounded-2xl transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 p-4 rounded-2xl flex items-start space-x-2.5 text-red-200 text-xs font-medium">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-300 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Request Title */}
          <div>
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">Request Title</label>
            <input
              id="modal_title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., AC Cooling Leak in Room 302"
              className="block w-full border border-white/20 rounded-2xl p-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 bg-white/10 hover:bg-white/15 text-sm transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Department */}
            <div>
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">Department</label>
              <select
                id="modal_department"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="block w-full border border-white/20 rounded-2xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 bg-slate-900 text-sm cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-white">Select Department</option>
                {ALL_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept} className="bg-slate-900 text-white">
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">Priority</label>
              <select
                id="modal_priority"
                required
                value={priority}
                onChange={(e) => setPriority(e.target.value as RequestPriority)}
                className="block w-full border border-white/20 rounded-2xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 bg-slate-900 text-sm cursor-pointer"
              >
                <option value="Low" className="bg-slate-900 text-white">Low</option>
                <option value="Medium" className="bg-slate-900 text-white">Medium</option>
                <option value="High" className="bg-slate-900 text-white">High</option>
                <option value="Urgent" className="bg-slate-900 text-white">Urgent</option>
              </select>
            </div>
          </div>

          {/* Problem Description */}
          <div>
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">Problem Description</label>
            <textarea
              id="modal_description"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue or service required..."
              rows={4}
              className="block w-full border border-white/20 rounded-2xl p-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 bg-white/10 hover:bg-white/15 text-sm transition resize-none"
            />
          </div>

          {/* Attachment (Optional) */}
          <div>
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <Paperclip className="h-4 w-4 text-slate-400" />
              <span>Attachment URL (Optional)</span>
            </label>
            <input
              id="modal_attachment"
              type="text"
              value={attachment}
              onChange={(e) => setAttachment(e.target.value)}
              placeholder="e.g., https://example.com/photo.png or document link"
              className="block w-full border border-white/20 rounded-2xl p-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 bg-white/10 hover:bg-white/15 text-sm transition"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/15">
            <button
              id="btn_modal_cancel"
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 rounded-2xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn_modal_submit"
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 border border-white/20 rounded-2xl shadow-lg transition cursor-pointer active:scale-95"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

