import { create } from 'zustand';
import { Model, SystemInfo } from '../types/settings';
import { api } from '../lib/tauri';

export interface ModelDownloadProgress {
  modelId: string;
  downloaded: number;
  total: number;
  speedBps: number;
}

export interface ModelDownloadError {
  modelId: string;
  message: string;
}

interface SettingsStore {
  settings: Record<string, string>;
  models: Model[];
  systemInfo: SystemInfo | null;
  downloadProgress: ModelDownloadProgress | null;
  downloadError: ModelDownloadError | null;
  isLoading: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
  fetchModels: () => Promise<void>;
  fetchSystemInfo: () => Promise<void>;
  saveSetting: (key: string, value: string) => Promise<void>;
  downloadModel: (modelId: string) => Promise<void>;
  cancelModelDownload: (modelId: string) => Promise<void>;
  setActiveModel: (modelId: string) => Promise<void>;
  setDownloadProgress: (progress: ModelDownloadProgress | null) => void;
  setDownloadError: (err: ModelDownloadError | null) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: {},
  models: [],
  systemInfo: null,
  downloadProgress: null,
  downloadError: null,
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    try {
      const settings = await api.settings.getAll();
      set({ settings });
    } catch (err: any) {
      set({ error: err?.toString() });
    }
  },

  fetchModels: async () => {
    try {
      const models = await api.models.list();
      set({ models });
    } catch (err: any) {
      set({ error: err?.toString() });
    }
  },

  fetchSystemInfo: async () => {
    try {
      const systemInfo = await api.system.getInfo();
      set({ systemInfo });
    } catch (err: any) {
      set({ error: err?.toString() });
    }
  },

  saveSetting: async (key: string, value: string) => {
    try {
      await api.settings.set(key, value);
      set((state) => ({ settings: { ...state.settings, [key]: value } }));
    } catch (err: any) {
      set({ error: err?.toString() });
    }
  },

  downloadModel: async (modelId: string) => {
    try {
      set({ downloadError: null });
      await api.models.download(modelId);
      await get().fetchModels();
    } catch (err: any) {
      const errMsg = err?.toString() || 'Failed to start model download';
      set({ downloadError: { modelId, message: errMsg }, error: errMsg });
    }
  },

  cancelModelDownload: async (modelId: string) => {
    try {
      await api.models.cancelDownload(modelId);
      set({ downloadProgress: null, downloadError: null });
      await get().fetchModels();
    } catch (err: any) {
      set({ error: err?.toString() });
    }
  },

  setActiveModel: async (modelId: string) => {
    try {
      await api.models.setActive(modelId);
      await get().fetchModels();
    } catch (err: any) {
      set({ error: err?.toString() });
    }
  },

  setDownloadProgress: (progress) => {
    set({ downloadProgress: progress });
  },

  setDownloadError: (err) => {
    set({ downloadError: err });
  },
}));
