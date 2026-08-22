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
      className="cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600 hover:shadow-xs transition-all duration-200"
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-base group-hover:text-neutral-950 dark:group-hover:text-white truncate">
              {job.title}
            </h3>
            <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex-wrap">
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
              className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
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
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-center">
          <div className="p-2 bg-neutral-100 dark:bg-neutral-800/90 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-center gap-1 text-neutral-600 dark:text-neutral-400 text-[11px] font-medium">
              <Users className="h-3 w-3" /> Total
            </div>
            <p className="font-bold text-neutral-950 dark:text-white text-sm mt-0.5 font-mono">{job.candidateCount}</p>
          </div>

          <div className="p-2 bg-neutral-100 dark:bg-neutral-800/90 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-center gap-1 text-neutral-600 dark:text-neutral-400 text-[11px] font-medium">
              <CheckCircle className="h-3 w-3" /> Shortlisted
            </div>
            <p className="font-bold text-neutral-950 dark:text-white text-sm mt-0.5 font-mono">{job.shortlistedCount}</p>
          </div>

          <div className="p-2 bg-neutral-100 dark:bg-neutral-800/90 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-center gap-1 text-neutral-600 dark:text-neutral-400 text-[11px] font-medium">
              <Clock className="h-3 w-3" /> Processing
            </div>
            <p className="font-bold text-neutral-950 dark:text-white text-sm mt-0.5 font-mono">{job.processingCount}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500 pt-1">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Added {formatDate(job.createdAt)}
          </span>
          <span className="text-neutral-900 dark:text-white font-semibold hover:underline">View Candidates →</span>
        </div>
      </CardContent>
    </Card>
  );
}
