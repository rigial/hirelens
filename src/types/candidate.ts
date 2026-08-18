import { ResumeStatus } from './processing';

export interface MatchedSkill {
  skill: string;
  importance: 'required' | 'nice-to-have';
}

export interface ScoreBreakdown {
  overallScore: number;
  skillsScore: number;
  experienceScore: number;
  semanticScore: number;
  llmScore: number;
}

export interface Education {
  degree: string;
  institution: string;
  year: string | null;
}

export interface WorkExperience {
  title: string;
  company: string;
  duration: string | null;
}

export interface CandidateAnalysis {
  id: string;
  candidateId: string;
  jobId: string;
  resumeId: string;
  scores: ScoreBreakdown;
  rank: number;
  extractedSkills: string[];
  matchedSkills: MatchedSkill[];
  missingSkills: MatchedSkill[];
  experienceYears: number | null;
  education: Education[];
  previousRoles: WorkExperience[];
  aiSummary: string | null;
  strengths: string[];
  concerns: string[];
}

export interface Candidate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
}

export interface CandidateWithAnalysis extends Candidate {
  resumeId: string;
  resumeStatus: ResumeStatus;
  resumeError: string | null;
  analysis: CandidateAnalysis | null;
  shortlistStatus: 'pending' | 'shortlisted' | 'rejected';
  shortlistNotes: string | null;
}

export interface CandidateDetail extends Candidate {
  resumeId: string;
  fileName: string;
  filePath: string;
  rawText: string | null;
  analysis: CandidateAnalysis | null;
  shortlistStatus: 'pending' | 'shortlisted' | 'rejected';
  shortlistNotes: string | null;
}
