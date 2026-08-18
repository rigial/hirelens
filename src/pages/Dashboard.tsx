import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Users,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useJobStore } from '../stores/useJobStore';
import { JobCard } from '../components/jobs/JobCard';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function Dashboard() {
  const navigate = useNavigate();
  const { jobs, fetchJobs } = useJobStore();

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const totalCandidates = jobs.reduce((sum, j) => sum + j.candidateCount, 0);
  const totalShortlisted = jobs.reduce((sum, j) => sum + j.shortlistedCount, 0);
  const totalProcessing = jobs.reduce((sum, j) => sum + j.processingCount, 0);

  const activeJobs = jobs.slice(0, 4);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
            Overview • {today}
          </p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
            Talent Screening Dashboard
          </h1>
        </div>

        <Button onClick={() => navigate('/jobs/new')} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Create Job Opening
        </Button>
      </div>

      {/* Stats Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200/80">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Active Jobs</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{jobs.length}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Candidates</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{totalCandidates}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Shortlisted</p>
              <h3 className="text-2xl font-bold text-emerald-900 mt-0.5">{totalShortlisted}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Queue / Processing</p>
              <h3 className="text-2xl font-bold text-amber-900 mt-0.5">{totalProcessing}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Jobs Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Active Job Openings</h2>
          {jobs.length > 4 && (
            <button
              onClick={() => navigate('/jobs')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              View all ({jobs.length}) <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {activeJobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl p-8 space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Ready to screen your first role?</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Create a job opening, configure required skills, and drop resumes to let the local AI rank candidates.
              </p>
            </div>
            <Button onClick={() => navigate('/jobs/new')} className="gap-2">
              <Plus className="h-4 w-4" /> Create Opening
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
