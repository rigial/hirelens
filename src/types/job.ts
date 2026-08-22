export interface Skill {
  id: string;
  skill: string;
  importance: 'required' | 'nice-to-have';
}

export interface SkillPayload {
  skill: string;
  importance: 'required' | 'nice-to-have';
}

export interface Job {
  id: string;
  title: string;
  description: string;
  location: string | null;
  employmentType: 'full-time' | 'part-time' | 'contract' | 'internship' | null;
  experienceRequiredYears: number | null;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  status: 'active' | 'archived';
  skills: Skill[];
  createdAt: string;
  updatedAt: string;
}

export interface JobSummary {
  id: string;
  title: string;
  location: string | null;
  employmentType: 'full-time' | 'part-time' | 'contract' | 'internship' | null;
  experienceRequiredYears: number | null;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  status: 'active' | 'archived';
  candidateCount: number;
  shortlistedCount: number;
  processingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobPayload {
  title: string;
  description: string;
  location?: string | null;
  employmentType?: string | null;
  experienceRequiredYears?: number | null;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  skills: SkillPayload[];
}

export interface UpdateJobPayload {
  title: string;
  description: string;
  location?: string | null;
  employmentType?: string | null;
  experienceRequiredYears?: number | null;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  skills: SkillPayload[];
}
