import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { api } from '../../lib/tauri';
import { DuplicateResumeInfo } from '../../types/processing';
import { Button } from '../ui/Button';
import { DuplicateUploadDialog } from './DuplicateUploadDialog';

/**
 * Props for the DropZone upload area component.
 */
export interface DropZoneProps {
  /** Target job ID where resumes will be uploaded. */
  jobId: string;
  /** Callback fired after resumes are successfully uploaded and enqueued. */
  onUploaded?: () => void;
}

/**
 * Interactive drag-and-drop file upload zone for candidate resumes with automated
 * duplicate detection checking and confirmation before upload in monochrome style.
 *
 * @param props - The component props
 * @param props.jobId - Target job ID where resumes will be uploaded
 * @param props.onUploaded - Optional callback fired after resumes are successfully uploaded
 */
export function DropZone({ jobId, onUploaded }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadSuccessCount, setUploadSuccessCount] = useState<number | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateResumeInfo[]>([]);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const triggerSuccess = (count: number) => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    setUploadSuccessCount(count);
    successTimeoutRef.current = setTimeout(() => {
      setUploadSuccessCount(null);
      successTimeoutRef.current = null;
    }, 4000);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isUploading) return;

    setErrorMessage(null);
    setUploadSuccessCount(null);

    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || isUploading) return;
    const files = Array.from(e.target.files);
    await processFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const executeUpload = async (paths: string[]) => {
    if (paths.length === 0) return;
    setIsUploading(true);
    setErrorMessage(null);
    try {
      await api.resumes.upload(jobId, paths);
      triggerSuccess(paths.length);
      if (onUploaded) onUploaded();
    } catch (err: any) {
      setErrorMessage(err?.toString() || 'Failed to upload resumes');
    } finally {
      setIsUploading(false);
    }
  };

  const initiateUploadWithDuplicateCheck = async (filePaths: string[]) => {
    if (filePaths.length === 0) return;
    setIsUploading(true);
    setErrorMessage(null);
    setUploadSuccessCount(null);

    try {
      // Check if any files already exist for this job (same name and size)
      const duplicateResults = await api.resumes.checkDuplicates(jobId, filePaths);
      const hasDuplicates = duplicateResults.some((item) => item.isDuplicate);

      if (hasDuplicates) {
        setDuplicateCandidates(duplicateResults);
        setIsDuplicateDialogOpen(true);
        setIsUploading(false);
        return;
      }

      // No duplicates detected, proceed directly with upload
      await api.resumes.upload(jobId, filePaths);
      triggerSuccess(filePaths.length);
      if (onUploaded) onUploaded();
    } catch (err: any) {
      setErrorMessage(err?.toString() || 'Failed to process resumes');
    } finally {
      setIsUploading(false);
    }
  };

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Filter valid formats (.pdf, .doc, .docx)
    const validFiles = files.filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ext === 'pdf' || ext === 'docx' || ext === 'doc';
    });

    if (validFiles.length === 0) {
      setErrorMessage('Please upload valid PDF or DOCX files.');
      return;
    }

    try {
      const filePaths: string[] = [];
      for (const file of validFiles) {
        // @ts-expect-error Tauri attaches path property to dropped/selected Files
        if (file.path) {
          // @ts-expect-error path property
          filePaths.push(file.path);
        }
      }

      if (filePaths.length > 0) {
        await initiateUploadWithDuplicateCheck(filePaths);
      } else {
        setErrorMessage('Could not determine local file path. Please use Browse Files to select resumes.');
      }
    } catch (err: any) {
      setErrorMessage(err?.toString() || 'Failed to upload resumes');
    }
  };

  const handleBrowseClick = async () => {
    if (isUploading) return;
    setErrorMessage(null);
    setUploadSuccessCount(null);

    try {
      const selected = await open({
        multiple: true,
        title: 'Select Resumes to Upload',
        filters: [
          {
            name: 'Resume Documents (*.pdf, *.docx, *.doc)',
            extensions: ['pdf', 'docx', 'doc'],
          },
        ],
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        if (paths.length > 0) {
          await initiateUploadWithDuplicateCheck(paths);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.toString() || 'Failed to open native file picker');
    }
  };

  const handleConfirmUploadAll = async () => {
    setIsDuplicateDialogOpen(false);
    const allPaths = duplicateCandidates.map((d) => d.filePath);
    await executeUpload(allPaths);
  };

  const handleConfirmSkipDuplicates = async () => {
    setIsDuplicateDialogOpen(false);
    const nonDuplicatePaths = duplicateCandidates
      .filter((d) => !d.isDuplicate)
      .map((d) => d.filePath);

    if (nonDuplicatePaths.length > 0) {
      await executeUpload(nonDuplicatePaths);
    }
  };

  const handleCancelDuplicates = () => {
    setIsDuplicateDialogOpen(false);
    setDuplicateCandidates([]);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer select-none ${
          isDragging
            ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800 scale-[1.01]'
            : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 hover:bg-neutral-100/60 dark:hover:bg-neutral-850 hover:border-neutral-400 dark:hover:border-neutral-600'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-2.5">
          <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white flex items-center justify-center border border-neutral-200 dark:border-neutral-700">
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : uploadSuccessCount !== null ? (
              <CheckCircle2 className="h-5 w-5 text-neutral-900 dark:text-white" />
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              {isUploading
                ? 'Uploading resumes to queue...'
                : uploadSuccessCount !== null
                ? `Uploaded ${uploadSuccessCount} resume${uploadSuccessCount > 1 ? 's' : ''} successfully`
                : 'Drag & drop resumes or click to browse'}
            </p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Supports batch PDF & DOCX resumes
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleBrowseClick();
            }}
            disabled={isUploading}
            className="text-xs gap-1.5 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" />
            Browse Files
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Duplicate resume upload confirmation modal */}
      <DuplicateUploadDialog
        isOpen={isDuplicateDialogOpen}
        duplicateItems={duplicateCandidates}
        onConfirmUploadAll={handleConfirmUploadAll}
        onConfirmSkipDuplicates={handleConfirmSkipDuplicates}
        onCancel={handleCancelDuplicates}
      />
    </div>
  );
}
