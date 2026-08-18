import { useEffect } from 'react';
import { useJobStore } from '../stores/useJobStore';

export function useJobs() {
  const { jobs, isLoading, error, fetchJobs, createJob, updateJob, archiveJob } = useJobStore();

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return {
    jobs,
    isLoading,
    error,
    refetch: fetchJobs,
    createJob,
    updateJob,
    archiveJob,
  };
}
