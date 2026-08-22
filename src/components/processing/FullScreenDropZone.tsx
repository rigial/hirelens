import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UploadCloud, FileText, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { DuplicateResumeInfo } from '../../types/processing';
import { DuplicateUploadDialog } from './DuplicateUploadDialog';
import { api } from '../../lib/tauri';

export interface FullScreenDropZoneProps {
  jobId: string;
  jobTitle?: string;
  onUploaded?: () => void;
}

export function FullScreenDropZone({ jobId, jobTitle, onUploaded }: FullScreenDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateResumeInfo[]>([]);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const dragCounter = useRef(0);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSuccess = (count: number) => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    setSuccessCount(count);
    successTimeoutRef.current = setTimeout(() => {
      setSuccessCount(null);
      successTimeoutRef.current = null;
    }, 4000);
  };

  const processFilePaths = useCallback(async (filePaths: string[]) => {
    if (filePaths.length === 0 || !jobId) return;

    // Filter valid resume extensions (.pdf, .docx, .doc)
    const validPaths = filePaths.filter((path) => {
      const lower = path.toLowerCase();
      return lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.doc');
    });

    if (validPaths.length === 0) {
      setErrorMessage('Only PDF, DOCX, and DOC resume documents are supported.');
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      // Duplicate detection
      const duplicateResults = await api.resumes.checkDuplicates(jobId, validPaths);
      const hasDuplicates = duplicateResults.some((item) => item.isDuplicate);

      if (hasDuplicates) {
        setDuplicateCandidates(duplicateResults);
        setIsDuplicateDialogOpen(true);
        setIsUploading(false);
        return;
      }

      // Direct upload
      await api.resumes.upload(jobId, validPaths);
      triggerSuccess(validPaths.length);
      if (onUploaded) {
        onUploaded();
      }
    } catch (err: any) {
      setErrorMessage(err?.toString() || 'Failed to upload dropped resumes');
      setTimeout(() => setErrorMessage(null), 6000);
    } finally {
      setIsUploading(false);
    }
  }, [jobId, onUploaded]);

  // Listen to Tauri 2 Native Webview drag & drop events
  useEffect(() => {
    let unlistenTauri: (() => void) | undefined;

    try {
      const webview = getCurrentWebview();
      webview.onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === 'enter' || payload.type === 'over') {
          setIsDragOver(true);
        } else if (payload.type === 'leave') {
          setIsDragOver(false);
        } else if (payload.type === 'drop') {
          setIsDragOver(false);
          if (payload.paths && payload.paths.length > 0) {
            processFilePaths(payload.paths);
          }
        }
      }).then((unlisten) => {
        unlistenTauri = unlisten;
      }).catch((e) => {
        console.warn('Tauri onDragDropEvent not available in browser mode:', e);
      });
    } catch (e) {
      console.warn('getCurrentWebview failed:', e);
    }

    // HTML5 window drag-and-drop fallback
    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current += 1;
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        setIsDragOver(true);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragOver(false);
      }
    };

    const handleWindowDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);

      if (e.dataTransfer && e.dataTransfer.files) {
        const paths: string[] = [];
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          // @ts-expect-error path property attached by Tauri
          if (file.path) {
            // @ts-expect-error path property
            paths.push(file.path);
          }
        }
        if (paths.length > 0) {
          processFilePaths(paths);
        }
      }
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      if (unlistenTauri) unlistenTauri();
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, [processFilePaths]);

  const handleConfirmUploadAll = async () => {
    setIsDuplicateDialogOpen(false);
    const allPaths = duplicateCandidates.map((d) => d.filePath);
    try {
      setIsUploading(true);
      await api.resumes.upload(jobId, allPaths);
      triggerSuccess(allPaths.length);
      if (onUploaded) onUploaded();
    } catch (err: any) {
      setErrorMessage(err?.toString() || 'Failed to upload resumes');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmSkipDuplicates = async () => {
    setIsDuplicateDialogOpen(false);
    const nonDuplicatePaths = duplicateCandidates
      .filter((d) => !d.isDuplicate)
      .map((d) => d.filePath);

    if (nonDuplicatePaths.length > 0) {
      try {
        setIsUploading(true);
        await api.resumes.upload(jobId, nonDuplicatePaths);
        triggerSuccess(nonDuplicatePaths.length);
        if (onUploaded) onUploaded();
      } catch (err: any) {
        setErrorMessage(err?.toString() || 'Failed to upload resumes');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleCancelDuplicates = () => {
    setIsDuplicateDialogOpen(false);
    setDuplicateCandidates([]);
  };

  return (
    <>
      {/* Full-Screen Drag-and-Drop Animated Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-8 transition-all animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
          <div className="relative flex flex-col items-center justify-center max-w-xl w-full p-12 text-center rounded-3xl border-3 border-dashed border-indigo-400 bg-slate-900/90 shadow-2xl space-y-6">
            {/* Glowing Accent Rings */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-indigo-500/20 blur-xl animate-pulse" />
              <div className="relative h-24 w-24 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-lg transform -rotate-3 animate-bounce">
                <UploadCloud className="h-12 w-12 stroke-[2.2]" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI Screening Pipeline</span>
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">
                Drop Resumes Anywhere
              </h2>
              <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                Release your candidate resumes to automatically parse profiles, extract skills, and rank matches for{' '}
                <span className="text-indigo-300 font-semibold">{jobTitle || 'this job opening'}</span>.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-indigo-400" /> PDF & DOCX Supported
              </span>
              <span>•</span>
              <span>Batch Uploading Enabled</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Status Toasts for Error / Success */}
      {errorMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs shadow-lg flex items-start gap-3 animate-in slide-in-from-bottom-3 duration-200">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Upload Notice: </span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {successCount !== null && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs shadow-lg flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200 font-semibold">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Uploaded {successCount} resume{successCount > 1 ? 's' : ''} to processing queue!</span>
        </div>
      )}

      {/* Duplicate Dialog */}
      <DuplicateUploadDialog
        isOpen={isDuplicateDialogOpen}
        duplicateItems={duplicateCandidates}
        onConfirmUploadAll={handleConfirmUploadAll}
        onConfirmSkipDuplicates={handleConfirmSkipDuplicates}
        onCancel={handleCancelDuplicates}
      />
    </>
  );
}
