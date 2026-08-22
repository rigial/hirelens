import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, RotateCcw, AlertCircle, Loader2, FileWarning, Trash2 } from 'lucide-react';
import { CandidateWithAnalysis } from '../../types/candidate';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ScoreRing } from '../ui/ScoreRing';
import { useCandidateStore } from '../../stores/useCandidateStore';

interface CandidateCardProps {
  candidate: CandidateWithAnalysis;
  jobId: string;
  onUpdateStatus: (candidateId: string, status: string) => void;
}

/**
 * Displays a candidate's resume analysis, radial match score ring, processing state, shortlist status, and available actions in monochrome style.
 *
 * @param candidate - The candidate and resume analysis data to display
 * @param jobId - The job associated with the candidate
 * @param onUpdateStatus - Callback invoked when the candidate's shortlist status changes
 */
export function CandidateCard({ candidate, jobId, onUpdateStatus }: CandidateCardProps) {
  const navigate = useNavigate();
  const { retryResume, deleteResume } = useCandidateStore();
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const analysis = candidate.analysis;

  const isPendingProcessing =
    candidate.resumeStatus === 'pending' ||
    candidate.resumeStatus === 'queued' ||
    candidate.resumeStatus === 'extracting' ||
    candidate.resumeStatus === 'analyzing';

  const isFailed = candidate.resumeStatus === 'failed';

  const isScannedPdf = Boolean(
    candidate.resumeError && (
      candidate.resumeError.toLowerCase().includes('scanned') ||
      candidate.resumeError.toLowerCase().includes('no extractable text') ||
      candidate.resumeError.toLowerCase().includes('text layer')
    )
  );

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRetrying || !candidate.resumeId) return;
    setIsRetrying(true);
    setRetryError(null);
    try {
      await retryResume(jobId, candidate.resumeId);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Retry failed';
      setRetryError(msg);
      setTimeout(() => setRetryError(null), 6000);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting || !candidate.resumeId) return;
    if (window.confirm(`Are you sure you want to delete ${candidate.name}'s resume? This action cannot be undone.`)) {
      setIsDeleting(true);
      try {
        await deleteResume(jobId, candidate.resumeId);
      } catch (err: any) {
        alert(err?.toString() || 'Failed to delete resume');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div
      onClick={() => navigate(`/jobs/${jobId}/candidates/${candidate.id}`)}
      className="group bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 rounded-xl p-4 transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
      {/* Left: Score Gauge, Name, Skills */}
      <div className="flex items-start md:items-center gap-4 flex-1 min-w-0">
        {/* Radial Score Gauge */}
        <div className="shrink-0 flex items-center justify-center">
          {analysis ? (
            <ScoreRing
              score={analysis.scores.overallScore}
              rank={analysis.rank}
              size="md"
            />
          ) : isPendingProcessing ? (
            <div className="h-[54px] w-[54px] rounded-full bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 flex flex-col items-center justify-center text-neutral-900 dark:text-white">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : isScannedPdf ? (
            <div className="h-[54px] w-[54px] rounded-full bg-neutral-100 dark:bg-neutral-850 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-neutral-800 dark:text-neutral-200" title="Scanned PDF Warning">
              <FileWarning className="h-5 w-5" />
            </div>
          ) : (
            <div className="h-[54px] w-[54px] rounded-full bg-neutral-100 dark:bg-neutral-850 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-neutral-900 dark:text-neutral-100">
              <AlertCircle className="h-5 w-5" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm group-hover:text-neutral-950 dark:group-hover:text-white truncate">
              {candidate.name}
            </h4>
            {candidate.email && (
              <span className="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                • {candidate.email}
              </span>
            )}
            {isScannedPdf && (
              <Badge variant="warning" className="gap-1 px-2 py-0.5 text-[10px] font-semibold">
                <FileWarning className="h-3 w-3" />
                <span>Scanned PDF (No Text Layer)</span>
              </Badge>
            )}
          </div>

          {/* Mini matched skills chips */}
          {analysis && analysis.matchedSkills.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {analysis.matchedSkills.slice(0, 4).map((s, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/80 dark:border-neutral-700"
                >
                  <Check className="h-2.5 w-2.5 text-neutral-900 dark:text-white stroke-[3]" />
                  {s.skill}
                </span>
              ))}
              {analysis.matchedSkills.length > 4 && (
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                  +{analysis.matchedSkills.length - 4} more
                </span>
              )}
            </div>
          ) : isPendingProcessing ? (
            <p className="text-xs text-neutral-700 dark:text-neutral-300 font-medium flex items-center gap-1.5">
              <span>Extracting profile & scoring candidate...</span>
              <span className="text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 px-1.5 py-0.2 rounded border border-neutral-200 dark:border-neutral-700 font-mono">
                ~8s remaining
              </span>
            </p>
          ) : isScannedPdf ? (
            <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-700 dark:text-neutral-300 font-medium">
              <span>PDF contains no extractable text layer (scanned/image). Please use OCR or a text-based document.</span>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-900 dark:text-neutral-100 underline cursor-pointer"
                title="Retry processing"
              >
                <RotateCcw className={`h-2.5 w-2.5 ${isRetrying ? 'animate-spin' : ''}`} />
                Retry
              </button>
              {retryError && <span className="text-[11px] text-neutral-900 dark:text-white font-semibold">{retryError}</span>}
            </div>
          ) : isFailed ? (
            <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-700 dark:text-neutral-300 font-medium">
              <span>{candidate.resumeError || 'Processing error'}</span>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-900 dark:text-neutral-100 underline cursor-pointer"
                title="Retry processing"
              >
                <RotateCcw className={`h-2.5 w-2.5 ${isRetrying ? 'animate-spin' : ''}`} />
                Retry
              </button>
              {retryError && <span className="text-[11px] text-neutral-900 dark:text-white font-semibold">{retryError}</span>}
            </div>
          ) : null}
        </div>
      </div>

      {/* Right: Experience, Status & Actions */}
      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-neutral-100 dark:border-neutral-800">
        {analysis?.experienceYears !== null && analysis?.experienceYears !== undefined && (
          <div className="text-right text-xs text-neutral-500 dark:text-neutral-400 mr-2 hidden sm:block">
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{analysis.experienceYears} yrs</span>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Experience</p>
          </div>
        )}

        <Badge
          variant={
            candidate.shortlistStatus === 'shortlisted'
              ? 'success'
              : candidate.shortlistStatus === 'rejected'
              ? 'destructive'
              : 'secondary'
          }
          className="capitalize text-xs font-semibold"
        >
          {candidate.shortlistStatus === 'shortlisted'
            ? 'Shortlisted'
            : candidate.shortlistStatus === 'rejected'
            ? 'Rejected'
            : 'Pending Review'}
        </Badge>

        {/* Action Buttons */}
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {candidate.shortlistStatus !== 'shortlisted' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUpdateStatus(candidate.id, 'shortlisted')}
              title="Shortlist Candidate"
              className="text-xs"
            >
              <Check className="h-3.5 w-3.5" /> Shortlist
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onUpdateStatus(candidate.id, 'pending')}
              title="Reset to Pending"
              className="text-xs text-neutral-500 dark:text-neutral-400"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          )}

          {candidate.shortlistStatus !== 'rejected' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onUpdateStatus(candidate.id, 'rejected')}
              title="Reject Candidate"
              className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            >
              <X className="h-3.5 w-3.5" /> Reject
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete Resume"
            className="text-xs text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-1.5"
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
