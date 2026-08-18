export type ModelTier = 'fast' | 'balanced' | 'quality';
export type ModelStatus = 'available' | 'downloading' | 'downloaded' | 'error';

export interface Model {
  id: string;
  displayName: string;
  tier: ModelTier;
  fileName: string;
  downloadUrl: string;
  sha256: string;
  sizeBytes: number;
  filePath: string | null;
  status: ModelStatus;
  isActive: boolean;
  downloadedAt: string | null;
}

export interface SystemInfo {
  ramGb: number;
  hasGpu: boolean;
  gpuType: string | null;
  recommendedModelTier: ModelTier;
  cpuCores: number;
}
