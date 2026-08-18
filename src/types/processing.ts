export type ResumeStatus =
  | 'pending'
  | 'queued'
  | 'extracting'
  | 'analyzing'
  | 'completed'
  | 'failed';

export interface ProcessingStatus {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  queued: number;
}

export interface Resume {
  id: string;
  candidateId: string | null;
  jobId: string;
  fileName: string;
  filePath: string;
  fileType: 'pdf' | 'doc' | 'docx';
  status: ResumeStatus;
  errorMessage: string | null;
  uploadedAt: string;
  processedAt?: string | null;
}

export interface CandidateAnalysisCompleteEvent {
  resume_id: string;
  job_id: string;
  candidate_id: string;
  overall_score: number;
}

export interface ResumeProcessingFailedEvent {
  resume_id: string;
  job_id: string;
  error: string;
}

export interface DuplicateResumeInfo {
  filePath: string;
  fileName: string;
  fileSize: number;
  isDuplicate: boolean;
  existingResumeId?: string | null;
  existingUploadedAt?: string | null;
  existingStatus?: string | null;
}

