import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../lib/tauri';
import { DuplicateResumeInfo } from '../../types/processing';
import { Button } from '../ui/Button';
import { DuplicateUploadDialog } from './DuplicateUploadDialog';

interface DropZoneProps {
  jobId: string;
  onUploaded?: () => void;
}

export function DropZone({ jobId, onUploaded }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateResumeInfo[]>([]);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMessage(null);

    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    await processFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const executeUpload = async (paths: string[]) => {
    if (paths.length === 0) return;
    setIsUploading(true);
    try {
      await api.resumes.upload(jobId, paths);
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
      // In Tauri webview, path is available on File object in desktop mode, or we can use dialog plugin
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
        // Fallback for file picker when path is missing
        try {
          const { open } = await import('@tauri-apps/plugin-dialog');
          const selected = await open({
            multiple: true,
            filters: [{ name: 'Resumes', extensions: ['pdf', 'docx', 'doc'] }],
          });
          if (selected) {
            const paths = Array.isArray(selected) ? selected : [selected];
            await initiateUploadWithDuplicateCheck(paths);
          }
        } catch {
          setErrorMessage('Failed to resolve file paths. Please use the Browse button.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.toString() || 'Failed to upload resumes');
    }
  };

  const handleBrowseClick = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Resumes', extensions: ['pdf', 'docx', 'doc'] }],
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        await initiateUploadWithDuplicateCheck(paths);
      }
    } catch {
      // Fallback to HTML input
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
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
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/40 scale-[1.01]'
            : 'border-slate-200/90 bg-slate-50/50 hover:bg-slate-50'
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
          <div className="h-10 w-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-800">
              Drag & drop resumes here
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Supports batch PDF & DOCX resumes
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBrowseClick}
            disabled={isUploading}
            className="text-xs gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            Browse Files
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
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

