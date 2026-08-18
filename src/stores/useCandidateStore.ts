import { create } from 'zustand';
import { CandidateWithAnalysis, CandidateDetail } from '../types/candidate';
import { ProcessingStatus, CandidateAnalysisCompleteEvent } from '../types/processing';
import { api } from '../lib/tauri';

interface CandidateStore {
  candidates: CandidateWithAnalysis[];
  activeCandidateDetail: CandidateDetail | null;
  processingStatus: ProcessingStatus | null;
  isLoading: boolean;
  error: string | null;
  fetchCandidates: (jobId: string) => Promise<void>;
  fetchCandidateDetail: (candidateId: string, jobId: string) => Promise<void>;
  updateShortlistStatus: (jobId: string, candidateId: string, status: string, notes?: string) => Promise<void>;
  retryResume: (jobId: string, resumeId: string) => Promise<void>;
  handleAnalysisComplete: (event: CandidateAnalysisCompleteEvent) => void;
  fetchProcessingStatus: (jobId: string) => Promise<void>;
}

export const useCandidateStore = create<CandidateStore>((set, get) => ({
  candidates: [],
  activeCandidateDetail: null,
  processingStatus: null,
  isLoading: false,
  error: null,

  fetchCandidates: async (jobId: string) => {
    set({ isLoading: true, error: null });
    try {
      const candidates = await api.candidates.list(jobId);
      set({ candidates, isLoading: false });
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to fetch candidates';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  fetchCandidateDetail: async (candidateId: string, jobId: string) => {
    set({ isLoading: true, error: null });
    try {
      const detail = await api.candidates.detail(candidateId, jobId);
      set({ activeCandidateDetail: detail, isLoading: false });
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to fetch candidate detail';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  updateShortlistStatus: async (jobId: string, candidateId: string, status: string, notes?: string) => {
    try {
      await api.candidates.updateStatus(jobId, candidateId, status, notes);
      set((state) => ({
        candidates: state.candidates.map((c) =>
          c.id === candidateId
            ? { ...c, shortlistStatus: status as any, shortlistNotes: notes || c.shortlistNotes }
            : c
        ),
        activeCandidateDetail:
          state.activeCandidateDetail?.id === candidateId
            ? {
                ...state.activeCandidateDetail,
                shortlistStatus: status as any,
                shortlistNotes: notes || state.activeCandidateDetail.shortlistNotes,
              }
            : state.activeCandidateDetail,
      }));
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to update shortlist status';
      set({ error: msg });
      throw err;
    }
  },

  retryResume: async (jobId: string, resumeId: string) => {
    try {
      await api.candidates.retry(resumeId);
      await Promise.all([
        get().fetchCandidates(jobId),
        get().fetchProcessingStatus(jobId),
      ]);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to retry processing resume';
      set({ error: msg });
      throw err;
    }
  },

  handleAnalysisComplete: (event: CandidateAnalysisCompleteEvent) => {
    // Trigger candidate list refresh
    get().fetchCandidates(event.job_id).catch(() => {});
    get().fetchProcessingStatus(event.job_id).catch(() => {});
  },

  fetchProcessingStatus: async (jobId: string) => {
    try {
      const status = await api.resumes.getStatus(jobId);
      set({ processingStatus: status });
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to fetch processing status';
      console.error('Failed to fetch processing status:', msg);
      throw err;
    }
  },
}));
