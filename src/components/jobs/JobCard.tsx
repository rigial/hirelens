import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Users, CheckCircle, Clock, Calendar, Trash2, Loader2 } from 'lucide-react';
import { JobSummary } from '../../types/job';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { formatDate } from '../../lib/utils';
import { useJobStore } from '../../stores/useJobStore';

interface JobCardProps {
  job: JobSummary;
}

export function JobCard({ job }: JobCardProps) {
  const navigate = useNavigate();
  const { deleteJob } = useJobStore();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;
    if (
      window.confirm(
        `Are you sure you want to delete "${job.title}"? This will permanently remove the job opening and all ${job.candidateCount} uploaded resumes.`
      )
    ) {
      setIsDeleting(true);
      try {
        await deleteJob(job.id);
      } catch (err: any) {
        alert(err?.toString() || 'Failed to delete job');
        setIsDeleting(false);
      }
    }
  };

  return (
    <Card
      onClick={() => navigate(`/jobs/${job.id}`)}
      className="cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all duration-200"
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 text-base group-hover:text-indigo-600 truncate">
              {job.title}
            </h3>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
              {job.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {job.location}
                </span>
              )}
              {job.employmentType && (
                <span className="capitalize">{job.employmentType}</span>
              )}
              <span>
                {(() => {
                  const min = job.minExperienceYears ?? (job.experienceRequiredYears && job.experienceRequiredYears > 0 ? job.experienceRequiredYears : null);
                  const max = job.maxExperienceYears ?? null;
                  if (min !== null && min !== undefined && max !== null && max !== undefined && max >= min) {
                    return min === max ? `${min} yrs exp` : `${min}-${max} yrs exp`;
                  }
                  if (min !== null && min !== undefined && min > 0) {
                    return `${min}+ yrs exp`;
                  }
                  if (max !== null && max !== undefined && max > 0) {
                    return `Up to ${max} yrs exp`;
                  }
                  return 'Any exp';
                })()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Badge variant={job.status === 'active' ? 'success' : 'secondary'} className="text-[11px] capitalize">
              {job.status}
            </Badge>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              title="Delete Job Opening"
              className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
          <div className="p-2 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-slate-500 text-[11px]">
              <Users className="h-3 w-3" /> Total
            </div>
            <p className="font-bold text-slate-900 text-sm mt-0.5">{job.candidateCount}</p>
          </div>

          <div className="p-2 bg-emerald-50/60 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-emerald-700 text-[11px]">
              <CheckCircle className="h-3 w-3" /> Shortlisted
            </div>
            <p className="font-bold text-emerald-900 text-sm mt-0.5">{job.shortlistedCount}</p>
          </div>

          <div className="p-2 bg-indigo-50/60 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-indigo-700 text-[11px]">
              <Clock className="h-3 w-3" /> Processing
            </div>
            <p className="font-bold text-indigo-900 text-sm mt-0.5">{job.processingCount}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Added {formatDate(job.createdAt)}
          </span>
          <span className="text-indigo-600 font-medium hover:underline">View Candidates →</span>
        </div>
      </CardContent>
    </Card>
  );
}

