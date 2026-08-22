import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Archive,
  Trash2,
  MapPin,
  Briefcase,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useJobStore } from '../stores/useJobStore';
import { useCandidateStore } from '../stores/useCandidateStore';
import { DropZone } from '../components/processing/DropZone';
import { FullScreenDropZone } from '../components/processing/FullScreenDropZone';
import { ProcessingStatusBar } from '../components/processing/ProcessingStatusBar';
import { CandidateList } from '../components/candidates/CandidateList';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { MarkdownView } from '../components/ui/MarkdownView';
import { api } from '../lib/tauri';

/**
 * Displays job details, candidate processing status, and candidates for the current job opening.
 *
 * Provides controls for editing, archiving, re-scoring candidates, uploading resumes, and updating shortlist statuses.
 */
export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { activeJob, fetchJob, archiveJob, deleteJob } = useJobStore();
  const {
    candidates,
    processingStatus,
    fetchCandidates,
    fetchProcessingStatus,
    updateShortlistStatus,
  } = useCandidateStore();

  const [descExpanded, setDescExpanded] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  useEffect(() => {
    if (jobId) {
      fetchJob(jobId);
      fetchCandidates(jobId);
      fetchProcessingStatus(jobId);
    }
  }, [jobId, fetchJob, fetchCandidates, fetchProcessingStatus]);

  const handleArchive = async () => {
    if (!jobId) return;
    if (window.confirm('Are you sure you want to archive this job opening?')) {
      await archiveJob(jobId);
      navigate('/jobs');
    }
  };

  const handleDeleteJob = async () => {
    if (!jobId || !activeJob) return;
    if (
      window.confirm(
        `Are you sure you want to delete "${activeJob.title}"? This will permanently delete the job and all associated resumes.`
      )
    ) {
      try {
        await deleteJob(jobId);
        navigate('/jobs');
      } catch (err: any) {
        alert(err?.toString() || 'Failed to delete job');
      }
    }
  };

  const handleReanalyzeAll = async () => {
    if (!jobId) return;
    setIsReanalyzing(true);
    try {
      await api.candidates.reanalyzeAll(jobId);
      await fetchProcessingStatus(jobId);
    } finally {
      setIsReanalyzing(false);
    }
  };

  if (!activeJob) {
    return (
      <div className="text-center py-20 text-slate-500 text-xs">
        Loading job opening details...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb */}
      <button
        onClick={() => navigate('/jobs')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Job Openings
      </button>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Job Details & Upload Zone) — 4 of 12 cols */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="border-slate-200/90 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={activeJob.status === 'active' ? 'success' : 'secondary'}
                    className="capitalize text-[10px]"
                  >
                    {activeJob.status}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/jobs/${jobId}/edit`)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                      title="Edit Job"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={handleArchive}
                      className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50"
                      title="Archive Job"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={handleDeleteJob}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      title="Delete Job Opening"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <h1 className="text-lg font-bold text-slate-900 leading-snug">
                  {activeJob.title}
                </h1>
              </div>

              {/* Attributes */}
              <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
                {activeJob.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{activeJob.location}</span>
                  </div>
                )}
                {activeJob.employmentType && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                    <span className="capitalize">{activeJob.employmentType}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {activeJob.experienceRequiredYears && activeJob.experienceRequiredYears > 0
                      ? `${activeJob.experienceRequiredYears} Years Experience Required`
                      : 'Any Experience Level'}
                  </span>
                </div>
              </div>

              {/* Required Skills */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-700">Skills Criteria</span>
                <div className="flex flex-wrap gap-1">
                  {activeJob.skills.map((s) => (
                    <Badge
                      key={s.id}
                      variant={s.importance === 'required' ? 'indigo' : 'secondary'}
                      className="text-[10px]"
                    >
                      {s.skill}
                    </Badge>
                  ))}
                  {activeJob.skills.length === 0 && (
                    <span className="text-xs text-slate-400 italic">No skills defined</span>
                  )}
                </div>
              </div>

              {/* Description Expandable */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-slate-700 hover:text-slate-900"
                >
                  <span>Role Description</span>
                  {descExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {descExpanded ? (
                  <MarkdownView
                    content={activeJob.description}
                    className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-lg text-xs"
                  />
                ) : (
                  <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-3">
                    {activeJob.description}
                  </div>
                )}
              </div>

              {/* Re-analyze Button */}
              {candidates.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReanalyzeAll}
                    disabled={isReanalyzing}
                    className="w-full text-xs gap-1.5"
                  >
                    <RefreshCw className={`h-3 w-3 ${isReanalyzing ? 'animate-spin' : ''}`} />
                    Re-score All Candidates
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload Zone */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Upload Resumes
              </span>
              <DropZone
                jobId={jobId!}
                onUploaded={() => {
                  if (jobId) {
                    fetchCandidates(jobId);
                    fetchProcessingStatus(jobId);
                  }
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column (Candidates & Rankings) — 8 of 12 cols */}
        <div className="lg:col-span-8 space-y-4">
          <ProcessingStatusBar status={processingStatus} />

          <CandidateList
            candidates={candidates}
            jobId={jobId!}
            onUpdateStatus={async (candId, status) => {
              if (jobId) {
                await updateShortlistStatus(jobId, candId, status);
              }
            }}
          />
        </div>
      </div>

      {/* Full-Screen Drag-and-Drop Drop Overlay */}
      {jobId && (
        <FullScreenDropZone
          jobId={jobId}
          jobTitle={activeJob.title}
          onUploaded={() => {
            fetchCandidates(jobId);
            fetchProcessingStatus(jobId);
          }}
        />
      )}
    </div>
  );
}

