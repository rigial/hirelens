import { create } from 'zustand';

interface ProcessingStore {
  activeUploads: Map<string, number>;
  addUpload: (resumeId: string) => void;
  updateUpload: (resumeId: string, progress: number) => void;
  removeUpload: (resumeId: string) => void;
}

export const useProcessingStore = create<ProcessingStore>((set) => ({
  activeUploads: new Map(),

  addUpload: (resumeId: string) => {
    set((state) => {
      const next = new Map(state.activeUploads);
      next.set(resumeId, 0);
      return { activeUploads: next };
    });
  },

  updateUpload: (resumeId: string, progress: number) => {
    set((state) => {
      const next = new Map(state.activeUploads);
      next.set(resumeId, progress);
      return { activeUploads: next };
    });
  },

  removeUpload: (resumeId: string) => {
    set((state) => {
      const next = new Map(state.activeUploads);
      next.delete(resumeId);
      return { activeUploads: next };
    });
  },
}));
