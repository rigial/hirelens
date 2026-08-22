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
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400 dark:text-neutral-500" />
            <input
              type="text"
              placeholder="Search job titles or locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 pl-9 pr-3 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 shadow-2xs">
            <Filter className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-8 bg-transparent text-xs text-neutral-800 dark:text-neutral-200 font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white cursor-pointer"
            >
              <option value="all" className="bg-white dark:bg-neutral-900">All</option>
              <option value="active" className="bg-white dark:bg-neutral-900">Active</option>
              <option value="archived" className="bg-white dark:bg-neutral-900">Archived</option>
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
        <div className="text-center py-16 bg-white dark:bg-neutral-900 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 space-y-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white">
            <Briefcase className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {search ? 'No matching job openings found' : 'No job openings yet'}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
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
