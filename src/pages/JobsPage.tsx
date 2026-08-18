import { useEffect } from 'react';
import { useJobStore } from '../stores/useJobStore';
import { JobList } from '../components/jobs/JobList';

export function JobsPage() {
  const { jobs, fetchJobs } = useJobStore();

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Job Openings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage roles, configure qualification criteria, and track candidate pipelines.
        </p>
      </div>

      <JobList jobs={jobs} />
    </div>
  );
}
