import { useEffect } from 'react';
import { useJobStore } from '../stores/useJobStore';
import { JobList } from '../components/jobs/JobList';

export function JobsPage() {
  const { jobs, fetchJobs } = useJobStore();

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return (
    <div className="h-full flex-1 overflow-y-auto overscroll-contain pr-1 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
          Job Openings
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Manage roles, configure qualification criteria, and track candidate pipelines.
        </p>
      </div>

      <JobList jobs={jobs} />
    </div>
  );
}
