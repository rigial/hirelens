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
 * Formats a byte count using an appropriate storage unit.
 *
 * @param bytes - The number of bytes to format
 * @param decimals - The maximum number of decimal places to display
 * @returns The formatted byte count with its storage unit
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
 * Formats an upload date for display.
 *
 * @param dateStr - The date string to format; missing values are displayed as "Recently"
 * @returns The formatted date, or the original string if formatting fails
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
 * in monochrome Light and Dark styling.
 *
 * @param props - The component props
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

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const getFocusableElements = () => {
      if (!dialogRef.current) return [];
      return Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
    };

    const focusable = getFocusableElements();
    if (focusable.length > 0) {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-dialog-title"
      aria-describedby="duplicate-dialog-desc"
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-neutral-100 dark:border-neutral-800 flex items-start gap-3.5 bg-neutral-50 dark:bg-neutral-800">
          <div className="h-10 w-10 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white flex items-center justify-center shrink-0 border border-neutral-300 dark:border-neutral-700">
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 id="duplicate-dialog-title" className="text-base font-bold text-neutral-950 dark:text-white leading-snug">
              Duplicate Resume{duplicates.length > 1 ? 's' : ''} Detected
            </h2>
            <p id="duplicate-dialog-desc" className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
              {duplicates.length === 1
                ? 'A file with the same name and file size already exists for this job opening.'
                : `${duplicates.length} files match the name and file size of resumes already uploaded for this job.`}
            </p>
          </div>

          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
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
              <Badge variant="secondary" className="text-[11px] font-semibold py-1 px-2.5">
                {newItems.length} New File{newItems.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Duplicate Files List */}
          <div className="space-y-2">
            <span className="font-semibold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wider block">
              Duplicate Files:
            </span>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {duplicates.map((item, idx) => (
                <div
                  key={`${item.filePath}-${idx}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate text-xs" title={item.fileName}>
                        {item.fileName}
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
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
            <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wider block">
                New Files ({newItems.length}):
              </span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {newItems.map((item, idx) => (
                  <div
                    key={`${item.filePath}-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100/60 dark:bg-neutral-800/60 gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-neutral-900 dark:text-white shrink-0" />
                      <span className="text-neutral-900 dark:text-neutral-100 font-medium truncate" title={item.fileName}>
                        {item.fileName}
                      </span>
                    </div>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 shrink-0">
                      {formatBytes(item.fileSize)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 leading-relaxed">
            Re-uploading duplicate resumes will create new processing entries and re-analyze candidate scores. You can also skip duplicate files to only process new resumes.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900 flex flex-col sm:flex-row items-center justify-end gap-2.5">
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
