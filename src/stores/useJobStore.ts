import { create } from 'zustand';
import { Job, JobSummary, CreateJobPayload, UpdateJobPayload } from '../types/job';
import { api } from '../lib/tauri';

interface JobStore {
  jobs: JobSummary[];
  activeJob: Job | null;
  isLoading: boolean;
  error: string | null;
  fetchJobs: () => Promise<void>;
  fetchJob: (jobId: string) => Promise<void>;
  createJob: (payload: CreateJobPayload) => Promise<Job>;
  updateJob: (jobId: string, payload: UpdateJobPayload) => Promise<Job>;
  archiveJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  activeJob: null,
  isLoading: false,
  error: null,

  fetchJobs: async () => {
    set({ isLoading: true, error: null });
    try {
      const jobs = await api.jobs.list();
      set({ jobs, isLoading: false });
    } catch (err: any) {
      set({ error: err?.toString() || 'Failed to fetch jobs', isLoading: false });
    }
  },

  fetchJob: async (jobId: string) => {
    set({ isLoading: true, error: null });
    try {
      const activeJob = await api.jobs.get(jobId);
      set({ activeJob, isLoading: false });
    } catch (err: any) {
      set({ error: err?.toString() || 'Failed to fetch job detail', isLoading: false });
    }
  },

  createJob: async (payload: CreateJobPayload) => {
    set({ isLoading: true, error: null });
    try {
      const job = await api.jobs.create(payload);
      await get().fetchJobs();
      set({ isLoading: false });
      return job;
    } catch (err: any) {
      set({ error: err?.toString() || 'Failed to create job', isLoading: false });
      throw err;
    }
  },

  updateJob: async (jobId: string, payload: UpdateJobPayload) => {
    set({ isLoading: true, error: null });
    try {
      const job = await api.jobs.update(jobId, payload);
      set({ activeJob: job, isLoading: false });
      await get().fetchJobs();
      return job;
    } catch (err: any) {
      set({ error: err?.toString() || 'Failed to update job', isLoading: false });
      throw err;
    }
  },

  archiveJob: async (jobId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.jobs.archive(jobId);
      await get().fetchJobs();
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err?.toString() || 'Failed to archive job', isLoading: false });
      throw err;
    }
  },

  deleteJob: async (jobId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.jobs.delete(jobId);
      set((state) => ({
        jobs: state.jobs.filter((j) => j.id !== jobId),
        activeJob: state.activeJob?.id === jobId ? null : state.activeJob,
        isLoading: false,
      }));
      await get().fetchJobs();
    } catch (err: any) {
      set({ error: err?.toString() || 'Failed to delete job', isLoading: false });
      throw err;
    }
  },
}));

