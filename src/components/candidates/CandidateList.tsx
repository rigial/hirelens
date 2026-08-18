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
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white border border-slate-200/80 rounded-xl p-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidates by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses ({candidates.length})</option>
              <option value="pending">Pending Review</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="score">Ranked by Score</option>
              <option value="name">Sort by Name</option>
              <option value="recent">Sort by Upload</option>
            </select>
          </div>
        </div>
      </div>

      {/* Candidate Rows */}
      {filtered.length > 0 ? (
        <div className="space-y-2.5">
          {filtered.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              jobId={jobId}
              onUpdateStatus={onUpdateStatus}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-xl p-6 space-y-2">
          <Users className="h-8 w-8 text-slate-400 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-800">No candidates match your criteria</h4>
          <p className="text-xs text-slate-500">
            Try adjusting your search keyword or clearing status filters.
          </p>
        </div>
      )}
    </div>
  );
}
