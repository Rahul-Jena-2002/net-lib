'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  X,
  Link as LinkIcon,
  Loader2,
  FileText,
} from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (bookId?: string) => void;
}

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [imageError, setImageError] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'uploading') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, status, onClose]);

  // Reset state when modal is opened
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setTitle('');
      setCoverUrl('');
      setStatus('idle');
      setMessage('');
      setImageError(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const dropped = droppedFiles[0];
      if (dropped.type === 'application/pdf' || dropped.name.toLowerCase().endsWith('.pdf')) {
        setFile(dropped);
        if (!title.trim()) {
          // Pre-populate clean title from filename
          const cleanName = dropped.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
          setTitle(cleanName);
        }
      } else {
        setStatus('error');
        setMessage('Please select a valid PDF file.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!title.trim()) {
        const cleanName = selected.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
        setTitle(cleanName);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus('uploading');
    setMessage('');

    const form = new FormData();
    form.append('file', file);
    if (title.trim()) form.append('title', title.trim());
    if (coverUrl.trim()) form.append('coverUrl', coverUrl.trim());

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message || 'Book added successfully!');

        // Cache cover URL in localStorage for immediate reflection
        if (data.book?.id && coverUrl.trim()) {
          try {
            localStorage.setItem(`netlib_cover_${data.book.id}`, coverUrl.trim());
          } catch {
            // ignore
          }
        }

        if (onSuccess) {
          onSuccess(data.book?.id);
        }

        // Auto close after brief pause
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setStatus('error');
        setMessage(data.error || 'Upload failed');
      }
    } catch {
      setStatus('error');
      setMessage('Network connection error while uploading');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/65 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={e => {
        if (e.target === e.currentTarget && status !== 'uploading') {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg liquid-glass-modal rounded-3xl p-6 sm:p-7 relative overflow-hidden text-inherit select-none shadow-none animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.06] border border-white/[0.12] flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight">Add Publication</h2>
              <p className="text-[11px] opacity-60">Upload a PDF directly to your NetLib library</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={status === 'uploading'}
            className="p-1.5 rounded-full hover:bg-white/10 opacity-70 hover:opacity-100 transition disabled:opacity-30"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success View */}
        {status === 'success' ? (
          <div className="py-8 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-emerald-400">Publication Added!</h3>
            <p className="text-xs opacity-70 max-w-xs">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-sky-400 bg-sky-500/10'
                  : file
                  ? 'border-emerald-400/40 bg-emerald-500/[0.04]'
                  : 'border-white/15 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.05]'
              }`}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <p className="text-xs font-semibold text-emerald-400 truncate">{file.name}</p>
                    <p className="text-[10px] opacity-60">{(file.size / (1024 * 1024)).toFixed(1)} MB · Ready to upload</p>
                  </div>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                    className="p-1 rounded-full hover:bg-white/10 opacity-60 hover:opacity-100 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 mx-auto mb-1.5 text-sky-400 opacity-80" />
                  <p className="text-xs font-medium">Drag & drop your PDF or click to browse</p>
                  <p className="opacity-40 text-[10px] mt-0.5">Supports single book and multi-chapter PDFs</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Custom Book Title */}
            <div>
              <label className="block text-xs font-medium opacity-80 mb-1">
                Book Title <span className="opacity-40 text-[10px] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="Leave blank to use filename or PDF title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/[0.09] text-inherit text-xs placeholder:opacity-40 focus:outline-none focus:border-sky-400/50 transition"
              />
            </div>

            {/* Cover Page Link with Live Preview */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium opacity-80 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 opacity-60" />
                  <span>Cover Page Link</span>
                  <span className="opacity-40 text-[10px] font-normal">(optional)</span>
                </label>
                <span className="text-[9px] opacity-40 font-mono">Image URL (.jpg, .png, .webp)</span>
              </div>

              <div className="relative flex items-center">
                <LinkIcon className="w-3.5 h-3.5 absolute left-3 opacity-40 pointer-events-none" />
                <input
                  type="url"
                  placeholder="https://... direct cover image URL"
                  value={coverUrl}
                  onChange={e => {
                    setCoverUrl(e.target.value);
                    setImageError(false);
                  }}
                  className="w-full pl-8 pr-8 py-2 rounded-xl bg-white/[0.05] border border-white/[0.09] text-inherit text-xs placeholder:opacity-40 focus:outline-none focus:border-sky-400/50 transition font-mono text-[11px]"
                />
                {coverUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setCoverUrl('');
                      setImageError(false);
                    }}
                    className="absolute right-2.5 p-1 rounded-full hover:bg-white/10 opacity-60 hover:opacity-100 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Real-time Cover Image Preview Card */}
              {coverUrl.trim() && (
                <div className="mt-2.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-3">
                  <div className="w-12 h-16 rounded-lg bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center shrink-0 relative">
                    {!imageError ? (
                      <img
                        src={coverUrl.trim()}
                        alt="Cover Preview"
                        className="w-full h-full object-contain p-0.5"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 opacity-80" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-slate-200">
                      {!imageError ? 'Cover Preview Valid' : 'Image URL Unreachable'}
                    </p>
                    <p className="text-[10px] opacity-50 truncate mt-0.5">
                      {!imageError
                        ? 'This artwork will be displayed in your library catalog'
                        : 'Verify direct image link or use another URL'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {status === 'error' && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={status === 'uploading'}
                className="px-3.5 py-2 rounded-full text-xs font-semibold hover:bg-white/[0.08] opacity-75 hover:opacity-100 transition disabled:opacity-30"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!file || status === 'uploading'}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-none"
              >
                {status === 'uploading' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing PDF...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Book</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
