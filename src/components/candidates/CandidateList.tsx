import { useState } from 'react';
import { Search, ArrowUpDown, Filter, Users } from 'lucide-react';
import { CandidateWithAnalysis } from '../../types/candidate';
import { CandidateCard } from './CandidateCard';

interface CandidateListProps {
  candidates: CandidateWithAnalysis[];
  jobId: string;
  onUpdateStatus: (candidateId: string, status: string) => void;
}

export function CandidateList({ candidates, jobId, onUpdateStatus }: CandidateListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'shortlisted' | 'rejected' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'recent'>('score');

  const filtered = candidates
    .filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'pending'
          ? c.shortlistStatus === 'pending' || !c.shortlistStatus
          : c.shortlistStatus === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'score') {
        const scoreA = a.analysis?.scores.overallScore ?? -1;
        const scoreB = b.analysis?.scores.overallScore ?? -1;
        return scoreB - scoreA;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-3 h-full">
      {/* Search & Filter Toolbar — Pinned / Fixed at Top */}
      <div className="shrink-0 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 rounded-xl p-3 shadow-2xs transition-colors">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400 dark:text-neutral-500" />
          <input
            type="text"
            placeholder="Search candidates by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-800/60 pl-9 pr-3 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1">
            <Filter className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-xs text-neutral-800 dark:text-neutral-200 font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white cursor-pointer"
            >
              <option value="all" className="bg-white dark:bg-neutral-900">All Statuses ({candidates.length})</option>
              <option value="pending" className="bg-white dark:bg-neutral-900">Pending Review</option>
              <option value="shortlisted" className="bg-white dark:bg-neutral-900">Shortlisted</option>
              <option value="rejected" className="bg-white dark:bg-neutral-900">Rejected</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1">
            <ArrowUpDown className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-neutral-800 dark:text-neutral-200 font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white cursor-pointer"
            >
              <option value="score" className="bg-white dark:bg-neutral-900">Ranked by Score</option>
              <option value="name" className="bg-white dark:bg-neutral-900">Sort by Name</option>
              <option value="recent" className="bg-white dark:bg-neutral-900">Sort by Upload</option>
            </select>
          </div>
        </div>
      </div>

      {/* Candidate Rows — Only This Container Scrolls */}
      <div className="flex-1 overflow-y-auto overscroll-contain pr-1.5 space-y-2.5 min-h-0">
        {filtered.length > 0 ? (
          filtered.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              jobId={jobId}
              onUpdateStatus={onUpdateStatus}
            />
          ))
        ) : (
          <div className="text-center py-12 bg-white dark:bg-neutral-900 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-2">
            <Users className="h-8 w-8 text-neutral-400 dark:text-neutral-500 mx-auto" />
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">No candidates match your criteria</h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Try adjusting your search keyword or clearing status filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
