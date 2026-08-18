import { useProcessingStore } from '../stores/useProcessingStore';
import { api } from '../lib/tauri';

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

