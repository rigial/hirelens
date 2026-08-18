import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import { CandidateWithAnalysis } from '../../types/candidate';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { getScoreColor } from '../../lib/utils';

interface CandidateCardProps {
  candidate: CandidateWithAnalysis;
  jobId: string;
  onUpdateStatus: (candidateId: string, status: string) => void;
}

export function CandidateCard({ candidate, jobId, onUpdateStatus }: CandidateCardProps) {
  const navigate = useNavigate();
  const analysis = candidate.analysis;
  const scoreColors = analysis ? getScoreColor(analysis.scores.overallScore) : null;

  const isPendingProcessing =
    candidate.resumeStatus === 'pending' ||
    candidate.resumeStatus === 'queued' ||
    candidate.resumeStatus === 'extracting' ||
    candidate.resumeStatus === 'analyzing';

  const isFailed = candidate.resumeStatus === 'failed';

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
            <p className="text-xs text-indigo-600 font-medium">
              Extracting candidate profile...
            </p>
          ) : isFailed ? (
            <p className="text-xs text-rose-600 font-medium">
              {candidate.resumeError || 'Processing error'}
            </p>
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
        </div>
      </div>
    </div>
  );
}
