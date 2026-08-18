import { useEffect } from 'react';
import { useCandidateStore } from '../stores/useCandidateStore';

export function useCandidates(jobId?: string) {
  const {
    candidates,
    activeCandidateDetail,
    processingStatus,
    isLoading,
    error,
    fetchCandidates,
    fetchCandidateDetail,
    updateShortlistStatus,
    fetchProcessingStatus,
  } = useCandidateStore();

  useEffect(() => {
    if (jobId) {
      fetchCandidates(jobId);
      fetchProcessingStatus(jobId);
    }
  }, [jobId, fetchCandidates, fetchProcessingStatus]);

  return {
    candidates,
    activeCandidateDetail,
    processingStatus,
    isLoading,
    error,
    refetch: () => jobId && fetchCandidates(jobId),
    fetchCandidateDetail: (candId: string) => jobId && fetchCandidateDetail(candId, jobId),
    updateShortlistStatus: (candId: string, status: string, notes?: string) =>
      jobId && updateShortlistStatus(jobId, candId, status, notes),
  };
}
