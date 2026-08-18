import { useProcessingStore } from '../stores/useProcessingStore';
import { api } from '../lib/tauri';

export function useProcessing() {
  const { activeUploads, addUpload, updateUpload, removeUpload } = useProcessingStore();

  const uploadFiles = async (jobId: string, filePaths: string[]) => {
    const resumes = await api.resumes.upload(jobId, filePaths);
    return resumes;
  };

  return {
    activeUploads,
    addUpload,
    updateUpload,
    removeUpload,
    uploadFiles,
  };
}
