import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Briefcase, Filter } from 'lucide-react';
import { JobSummary } from '../../types/job';
import { JobCard } from './JobCard';
import { Button } from '../ui/Button';

interface JobListProps {
  jobs: JobSummary[];
}

export function JobList({ jobs }: JobListProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      (job.location && job.location.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search job titles or locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 shadow-xs">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-8 bg-transparent text-xs text-slate-700 font-medium focus:outline-none"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <Button onClick={() => navigate('/jobs/new')} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> New Job Opening
        </Button>
      </div>

      {/* Grid */}
      {filteredJobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl p-8 space-y-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Briefcase className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">
              {search ? 'No matching job openings found' : 'No job openings yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {search
                ? 'Try refining your search keyword or clearing the filters.'
                : 'Create your first job opening to start uploading and evaluating candidate resumes.'}
            </p>
          </div>
          {!search && (
            <Button onClick={() => navigate('/jobs/new')} className="gap-2">
              <Plus className="h-4 w-4" /> Create First Job
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
