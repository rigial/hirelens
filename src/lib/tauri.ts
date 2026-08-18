import { invoke } from '@tauri-apps/api/core';
import { Job, JobSummary, CreateJobPayload, UpdateJobPayload } from '../types/job';
import { CandidateWithAnalysis, CandidateDetail } from '../types/candidate';
import { Resume, ProcessingStatus } from '../types/processing';
import { Model, SystemInfo } from '../types/settings';

export const api = {
  jobs: {
    list: () => invoke<JobSummary[]>('get_jobs'),
    get: (jobId: string) => invoke<Job>('get_job', { jobId }),
    create: (payload: CreateJobPayload) => invoke<Job>('create_job', { payload }),
    update: (jobId: string, payload: UpdateJobPayload) => invoke<Job>('update_job', { jobId, payload }),
    archive: (jobId: string) => invoke<void>('archive_job', { jobId }),
  },
  candidates: {
    list: (jobId: string) => invoke<CandidateWithAnalysis[]>('get_candidates', { jobId }),
    detail: (candidateId: string, jobId: string) =>
      invoke<CandidateDetail>('get_candidate_detail', { candidateId, jobId }),
    updateStatus: (jobId: string, candidateId: string, status: string, notes?: string) =>
      invoke<void>('update_shortlist_status', { jobId, candidateId, status, notes: notes || null }),
    retry: (resumeId: string) => invoke<void>('retry_resume', { resumeId }),
    reanalyzeAll: (jobId: string) => invoke<void>('reanalyze_job_candidates', { jobId }),
  },
  resumes: {
    upload: (jobId: string, filePaths: string[]) =>
      invoke<Resume[]>('upload_resumes', { jobId, filePaths }),
    getStatus: (jobId: string) => invoke<ProcessingStatus>('get_processing_status', { jobId }),
  },
  models: {
    list: () => invoke<Model[]>('get_models'),
    download: (modelId: string) => invoke<void>('download_model', { modelId }),
    cancelDownload: (modelId: string) => invoke<void>('cancel_model_download', { modelId }),
    setActive: (modelId: string) => invoke<void>('set_active_model', { modelId }),
  },
  system: {
    getInfo: () => invoke<SystemInfo>('get_system_info'),
  },
  settings: {
    getAll: () => invoke<Record<string, string>>('get_settings'),
    set: (key: string, value: string) => invoke<void>('set_setting', { key, value }),
  },
};
