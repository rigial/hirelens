import { useEffect, useRef } from 'react';
import { AlertTriangle, FileText, X, CheckCircle2, ArrowRight } from 'lucide-react';
import { DuplicateResumeInfo } from '../../types/processing';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

/**
 * Props for the DuplicateUploadDialog component.
 */
export interface DuplicateUploadDialogProps {
  /** Whether the duplicate confirmation modal is open. */
  isOpen: boolean;
  /** List of resume files evaluated for duplicate detection. */
  duplicateItems: DuplicateResumeInfo[];
  /** Callback when the user confirms re-uploading all files including duplicates. */
  onConfirmUploadAll: () => void;
  /** Callback when the user confirms uploading only non-duplicate files. */
  onConfirmSkipDuplicates: () => void;
  /** Callback when the user cancels the upload action. */
  onCancel: () => void;
}

/**
 * Formats a byte size into a human-readable string (KB, MB, etc.).
 */
function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Formats an ISO-8601 date string into a user-friendly short date format.
 */
function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Modal dialog presented to users when uploading resumes that duplicate existing files
 * previously uploaded for the current job opening. Provides options to re-upload all or skip duplicates.
 */
export function DuplicateUploadDialog({
  isOpen,
  duplicateItems,
  onConfirmUploadAll,
  onConfirmSkipDuplicates,
  onCancel,
}: DuplicateUploadDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Focus management: Trap focus inside modal, initial focus, and restore focus on dismiss
  useEffect(() => {
    if (!isOpen) return;

    // Save currently focused element to restore when dialog closes
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    // Query focusable elements
    const getFocusableElements = () => {
      if (!dialogRef.current) return [];
      return Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
    };

    // Focus the first actionable button or close button on open
    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      // Focus on the first element (e.g. Close button or Cancel)
      focusable[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }

      if (e.key === 'Tab') {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previous element when modal is dismissed
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const duplicates = duplicateItems.filter((item) => item.isDuplicate);
  const newItems = duplicateItems.filter((item) => !item.isDuplicate);
  const hasNewItems = newItems.length > 0;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-dialog-title"
      aria-describedby="duplicate-dialog-desc"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-start gap-3.5 bg-amber-50/40">
          <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/80">
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 id="duplicate-dialog-title" className="text-base font-bold text-slate-900 leading-snug">
              Duplicate Resume{duplicates.length > 1 ? 's' : ''} Detected
            </h2>
            <p id="duplicate-dialog-desc" className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              {duplicates.length === 1
                ? 'A file with the same name and file size already exists for this job opening.'
                : `${duplicates.length} files match the name and file size of resumes already uploaded for this job.`}
            </p>
          </div>

          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Summary pill tags */}
          <div className="flex items-center gap-2">
            <Badge variant="warning" className="text-[11px] font-semibold py-1 px-2.5">
              {duplicates.length} Duplicate{duplicates.length > 1 ? 's' : ''}
            </Badge>
            {hasNewItems && (
              <Badge variant="success" className="text-[11px] font-semibold py-1 px-2.5">
                {newItems.length} New File{newItems.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Duplicate Files List */}
          <div className="space-y-2">
            <span className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider block">
              Duplicate Files:
            </span>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {duplicates.map((item, idx) => (
                <div
                  key={`${item.filePath}-${idx}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-amber-200/90 bg-amber-50/30 gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-amber-100/80 text-amber-800 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate text-xs" title={item.fileName}>
                        {item.fileName}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatBytes(item.fileSize)} • Uploaded {formatDate(item.existingUploadedAt)}
                      </p>
                    </div>
                  </div>

                  {item.existingStatus && (
                    <Badge variant="secondary" className="capitalize text-[10px] shrink-0">
                      {item.existingStatus}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* New Files List (if any) */}
          {hasNewItems && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider block">
                New Files ({newItems.length}):
              </span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {newItems.map((item, idx) => (
                  <div
                    key={`${item.filePath}-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200/80 bg-slate-50/50 gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="text-slate-800 font-medium truncate" title={item.fileName}>
                        {item.fileName}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 shrink-0">
                      {formatBytes(item.fileSize)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
            Re-uploading duplicate resumes will create new processing entries and re-analyze candidate scores. You can also skip duplicate files to only process new resumes.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="w-full sm:w-auto text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onConfirmSkipDuplicates}
            className="w-full sm:w-auto text-xs gap-1.5"
          >
            {hasNewItems ? `Skip Duplicates & Upload New (${newItems.length})` : 'Skip Duplicates'}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onConfirmUploadAll}
            className="w-full sm:w-auto text-xs gap-1.5"
          >
            Re-upload All ({duplicateItems.length})
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
