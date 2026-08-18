import { useNavigate } from 'react-router-dom';
import { MapPin, Users, CheckCircle, Clock, Calendar } from 'lucide-react';
import { JobSummary } from '../../types/job';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { formatDate } from '../../lib/utils';

interface JobCardProps {
  job: JobSummary;
}

export function JobCard({ job }: JobCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      onClick={() => navigate(`/jobs/${job.id}`)}
      className="cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all duration-200"
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-900 text-base group-hover:text-indigo-600">
              {job.title}
            </h3>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              {job.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {job.location}
                </span>
              )}
              {job.employmentType && (
                <span className="capitalize">{job.employmentType}</span>
              )}
              {job.experienceRequiredYears !== null && job.experienceRequiredYears !== undefined && (
                <span>
                  {job.experienceRequiredYears > 0 ? `${job.experienceRequiredYears} yrs exp` : 'Any exp'}
                </span>
              )}
            </div>
          </div>

          <Badge variant={job.status === 'active' ? 'success' : 'secondary'} className="text-[11px] capitalize">
            {job.status}
          </Badge>
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
