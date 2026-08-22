import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, RotateCcw, AlertCircle, Loader2, FileWarning, Trash2 } from 'lucide-react';
import { CandidateWithAnalysis } from '../../types/candidate';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { getScoreColor } from '../../lib/utils';
import { useCandidateStore } from '../../stores/useCandidateStore';

interface CandidateCardProps {
  candidate: CandidateWithAnalysis;
  jobId: string;
  onUpdateStatus: (candidateId: string, status: string) => void;
}

/**
 * Displays a candidate's resume analysis, processing state, shortlist status, and available actions.
 *
 * @param candidate - The candidate and resume analysis data to display
 * @param jobId - The job associated with the candidate
 * @param onUpdateStatus - Callback invoked when the candidate's shortlist status changes
 * @returns The rendered candidate card
 */
export function CandidateCard({ candidate, jobId, onUpdateStatus }: CandidateCardProps) {
  const navigate = useNavigate();
  const { retryResume, deleteResume } = useCandidateStore();
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const analysis = candidate.analysis;
  const scoreColors = analysis ? getScoreColor(analysis.scores.overallScore) : null;

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
      className="group bg-white border border-slate-200/80 hover:border-indigo-300 rounded-xl p-4 transition-all duration-150 cursor-pointer shadow-xs hover:shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
      {/* Left: Rank, Name, Skills */}
      <div className="flex items-start md:items-center gap-4 flex-1 min-w-0">
        {/* Rank / Score */}
        <div className="shrink-0 text-center">
          {analysis ? (
            <div className={`h-12 w-12 rounded-xl flex flex-col items-center justify-center font-bold border ${scoreColors?.bg} ${scoreColors?.border}`}>
              <span className={`text-base font-extrabold leading-none ${scoreColors?.text}`}>
                {analysis.scores.overallScore.toFixed(0)}%
              </span>
              <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                #{analysis.rank}
              </span>
            </div>
          ) : isPendingProcessing ? (
            <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col items-center justify-center text-indigo-600">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : isScannedPdf ? (
            <div className="h-12 w-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600" title="Scanned PDF Warning">
              <FileWarning className="h-5 w-5" />
            </div>
          ) : (
            <div className="h-12 w-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <AlertCircle className="h-5 w-5" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-slate-900 text-sm group-hover:text-indigo-600 truncate">
              {candidate.name}
            </h4>
            {candidate.email && (
              <span className="text-xs text-slate-400 truncate">
                • {candidate.email}
              </span>
            )}
            {isScannedPdf && (
              <Badge variant="warning" className="gap-1 px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-800 border-amber-300">
                <FileWarning className="h-3 w-3 text-amber-600" />
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
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700"
                >
                  <Check className="h-2.5 w-2.5 text-emerald-600 stroke-[3]" />
                  {s.skill}
                </span>
              ))}
              {analysis.matchedSkills.length > 4 && (
                <span className="text-[10px] text-slate-400 font-medium">
                  +{analysis.matchedSkills.length - 4} more
                </span>
              )}
            </div>
          ) : isPendingProcessing ? (
            <p className="text-xs text-indigo-600 font-medium flex items-center gap-1.5">
              <span>Extracting profile & scoring candidate...</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-100 font-mono">
                ~8s remaining
              </span>
            </p>
          ) : isScannedPdf ? (
            <div className="flex items-center gap-2 flex-wrap text-xs text-amber-700 font-medium">
              <span>PDF contains no extractable text layer (scanned/image). Please use OCR or a text-based document.</span>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                title="Retry processing"
              >
                <RotateCcw className={`h-2.5 w-2.5 ${isRetrying ? 'animate-spin' : ''}`} />
                Retry
              </button>
              {retryError && <span className="text-[11px] text-rose-600 font-semibold">{retryError}</span>}
            </div>
          ) : isFailed ? (
            <div className="flex items-center gap-2 flex-wrap text-xs text-rose-600 font-medium">
              <span>{candidate.resumeError || 'Processing error'}</span>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                title="Retry processing"
              >
                <RotateCcw className={`h-2.5 w-2.5 ${isRetrying ? 'animate-spin' : ''}`} />
                Retry
              </button>
              {retryError && <span className="text-[11px] text-rose-600 font-semibold">{retryError}</span>}
            </div>
          ) : null}
        </div>
      </div>

      {/* Right: Experience, Status & Actions */}
      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
        {analysis?.experienceYears !== null && analysis?.experienceYears !== undefined && (
          <div className="text-right text-xs text-slate-500 mr-2 hidden sm:block">
            <span className="font-semibold text-slate-800">{analysis.experienceYears} yrs</span>
            <p className="text-[10px] text-slate-400">Experience</p>
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
              variant="subtle"
              onClick={() => onUpdateStatus(candidate.id, 'shortlisted')}
              title="Shortlist Candidate"
              className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800"
            >
              <Check className="h-3.5 w-3.5" /> Shortlist
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onUpdateStatus(candidate.id, 'pending')}
              title="Reset to Pending"
              className="text-xs text-slate-500"
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
              className="text-xs text-rose-600 hover:bg-rose-50"
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
            className="text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5"
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
