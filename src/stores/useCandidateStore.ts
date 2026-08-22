import { create } from 'zustand';
import { CandidateWithAnalysis, CandidateDetail } from '../types/candidate';
import { ProcessingStatus, CandidateAnalysisCompleteEvent } from '../types/processing';
import { api } from '../lib/tauri';

interface CandidateStore {
  activeJobId: string | null;
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
  handleAnalysisFailed: (event: { job_id: string; resume_id: string; error: string }) => void;
  handleProcessingUpdate: (jobId: string) => void;
  fetchProcessingStatus: (jobId: string) => Promise<void>;
  deleteResume: (jobId: string, resumeId: string) => Promise<void>;
}

let candidatesReqSeq = 0;
let candidateDetailReqSeq = 0;
let processingStatusReqSeq = 0;

export const useCandidateStore = create<CandidateStore>((set, get) => ({
  activeJobId: null,
  candidates: [],
  activeCandidateDetail: null,
  processingStatus: null,
  isLoading: false,
  error: null,

  fetchCandidates: async (jobId: string) => {
    const requestId = ++candidatesReqSeq;
    set({ activeJobId: jobId, isLoading: true, error: null });
    try {
      const candidates = await api.candidates.list(jobId);
      if (get().activeJobId === jobId && requestId === candidatesReqSeq) {
        set({ candidates, isLoading: false });
      }
    } catch (err: any) {
      if (get().activeJobId === jobId && requestId === candidatesReqSeq) {
        const msg = typeof err === 'string' ? err : err?.message || 'Failed to fetch candidates';
        set({ error: msg, isLoading: false });
      }
      throw err;
    }
  },

  fetchCandidateDetail: async (candidateId: string, jobId: string) => {
    const requestId = ++candidateDetailReqSeq;
    set({ activeJobId: jobId, isLoading: true, error: null });
    try {
      const detail = await api.candidates.detail(candidateId, jobId);
      if (get().activeJobId === jobId && requestId === candidateDetailReqSeq) {
        set({ activeCandidateDetail: detail, isLoading: false });
      }
    } catch (err: any) {
      if (get().activeJobId === jobId && requestId === candidateDetailReqSeq) {
        const msg = typeof err === 'string' ? err : err?.message || 'Failed to fetch candidate detail';
        set({ error: msg, isLoading: false });
      }
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
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to update candidate status';
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

  deleteResume: async (jobId: string, resumeId: string) => {
    try {
      await api.candidates.deleteResume(resumeId);
      set((state) => ({
        candidates: state.candidates.filter((c) => c.resumeId !== resumeId),
        activeCandidateDetail:
          state.activeCandidateDetail?.resumeId === resumeId ? null : state.activeCandidateDetail,
      }));
      await Promise.all([
        get().fetchCandidates(jobId),
        get().fetchProcessingStatus(jobId),
      ]);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to delete resume';
      set({ error: msg });
      throw err;
    }
  },

  handleAnalysisComplete: (event: CandidateAnalysisCompleteEvent) => {
    // Only refresh when event job_id matches currently viewed job opening
    if (get().activeJobId === event.job_id) {
      get().fetchCandidates(event.job_id).catch(() => {});
      get().fetchProcessingStatus(event.job_id).catch(() => {});
    }
  },

  handleAnalysisFailed: (event: { job_id: string; resume_id: string; error: string }) => {
    // Only refresh when event job_id matches currently viewed job opening
    if (get().activeJobId === event.job_id) {
      get().fetchCandidates(event.job_id).catch(() => {});
      get().fetchProcessingStatus(event.job_id).catch(() => {});
    }
  },

  handleProcessingUpdate: (jobId: string) => {
    // Only refresh when jobId matches currently viewed job opening
    if (get().activeJobId === jobId) {
      get().fetchProcessingStatus(jobId).catch(() => {});
    }
  },

  fetchProcessingStatus: async (jobId: string) => {
    const requestId = ++processingStatusReqSeq;
    try {
      const status = await api.resumes.getStatus(jobId);
      if (get().activeJobId === jobId && requestId === processingStatusReqSeq) {
        set({ processingStatus: status });
      }
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to fetch processing status';
      console.error('Failed to fetch processing status:', msg);
      throw err;
    }
  },
}));
