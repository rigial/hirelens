import { useProcessingStore } from '../stores/useProcessingStore';
import { api } from '../lib/tauri';

/**
 * Provides upload state, upload management actions, and resume processing operations.
 *
 * @returns The active uploads, upload management actions, file upload operation, and duplicate-check operation
 */
export function useProcessing() {
  const { activeUploads, addUpload, updateUpload, removeUpload } = useProcessingStore();

  const uploadFiles = async (jobId: string, filePaths: string[]) => {
    const resumes = await api.resumes.upload(jobId, filePaths);
    return resumes;
  };

  const checkDuplicates = async (jobId: string, filePaths: string[]) => {
    const duplicates = await api.resumes.checkDuplicates(jobId, filePaths);
    return duplicates;
  };

  return {
    activeUploads,
    addUpload,
    updateUpload,
    removeUpload,
    uploadFiles,
    checkDuplicates,
  };
}

