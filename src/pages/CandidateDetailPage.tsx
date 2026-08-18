import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useCandidateStore } from '../stores/useCandidateStore';
import { CandidateDetail } from '../components/candidates/CandidateDetail';

export function CandidateDetailPage() {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>();
  const { activeCandidateDetail, fetchCandidateDetail, updateShortlistStatus } = useCandidateStore();

  useEffect(() => {
    if (jobId && candidateId) {
      fetchCandidateDetail(candidateId, jobId);
    }
  }, [jobId, candidateId, fetchCandidateDetail]);

  if (!activeCandidateDetail) {
    return (
      <div className="text-center py-20 text-slate-500 text-xs">
        Loading candidate profile...
      </div>
    );
  }

  return (
    <CandidateDetail
      candidate={activeCandidateDetail}
      jobId={jobId!}
      onUpdateStatus={async (status, notes) => {
        if (jobId && candidateId) {
          await updateShortlistStatus(jobId, candidateId, status, notes);
        }
      }}
    />
  );
}
