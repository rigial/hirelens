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
 * Left panel and search bar remain fixed while the candidate list scrolls independently.
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

  // Periodic status refresh while background processing is active
  useEffect(() => {
    if (!jobId) return;
    const isProcessing = processingStatus && (processingStatus.inProgress > 0 || processingStatus.queued > 0);
    if (!isProcessing) return;

    const interval = setInterval(() => {
      fetchProcessingStatus(jobId);
      fetchCandidates(jobId);
    }, 2500);

    return () => clearInterval(interval);
  }, [jobId, processingStatus, fetchProcessingStatus, fetchCandidates]);

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
      await fetchCandidates(jobId);
    } finally {
      setIsReanalyzing(false);
    }
  };

  if (!activeJob) {
    return (
      <div className="text-center py-20 text-neutral-500 dark:text-neutral-400 text-xs">
        Loading job opening details...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden space-y-3">
      {/* Top Breadcrumb — Fixed */}
      <div className="shrink-0">
        <button
          onClick={() => navigate('/jobs')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Job Openings
        </button>
      </div>

      {/* Two Column Layout — Left is independently scrollable, Right isolates candidate scrolling */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden items-stretch">
        {/* Left Column (Job Details & Upload Zone) — 4 of 12 cols, fixed/independent scroll */}
        <div className="lg:col-span-4 flex flex-col min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-4">
          <Card className="border-neutral-200/90 dark:border-neutral-800 shadow-2xs shrink-0">
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
                      className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      title="Edit Job"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={handleArchive}
                      className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      title="Archive Job"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={handleDeleteJob}
                      className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      title="Delete Job Opening"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <h1 className="text-lg font-bold text-neutral-950 dark:text-white leading-snug">
                  {activeJob.title}
                </h1>
              </div>

              {/* Attributes */}
              <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                {activeJob.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
                    <span>{activeJob.location}</span>
                  </div>
                )}
                {activeJob.employmentType && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
                    <span className="capitalize">{activeJob.employmentType}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
                  <span>
                    {(() => {
                      const min = activeJob.minExperienceYears ?? (activeJob.experienceRequiredYears && activeJob.experienceRequiredYears > 0 ? activeJob.experienceRequiredYears : null);
                      const max = activeJob.maxExperienceYears ?? null;
                      if (min !== null && min !== undefined && max !== null && max !== undefined && max >= min) {
                        return min === max
                          ? `${min} Years Experience Required`
                          : `${min} - ${max} Years Experience Required`;
                      }
                      if (min !== null && min !== undefined && min > 0) {
                        return `${min}+ Years Experience Required`;
                      }
                      if (max !== null && max !== undefined && max > 0) {
                        return `Up to ${max} Years Experience Required`;
                      }
                      return 'Any Experience Level';
                    })()}
                  </span>
                </div>
              </div>

              {/* Required Skills */}
              <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Skills Criteria</span>
                <div className="flex flex-wrap gap-1">
                  {activeJob.skills.map((s) => (
                    <Badge
                      key={s.id}
                      variant={s.importance === 'required' ? 'default' : 'secondary'}
                      className="text-[10px]"
                    >
                      {s.skill}
                    </Badge>
                  ))}
                  {activeJob.skills.length === 0 && (
                    <span className="text-xs text-neutral-400 dark:text-neutral-500 italic">No skills defined</span>
                  )}
                </div>
              </div>

              {/* Description Expandable */}
              <div className="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:text-neutral-950 dark:hover:text-white cursor-pointer"
                >
                  <span>Role Description</span>
                  {descExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {descExpanded ? (
                  <MarkdownView
                    content={activeJob.description}
                    className="p-3.5 bg-neutral-100/70 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs"
                  />
                ) : (
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed whitespace-pre-wrap line-clamp-3">
                    {activeJob.description}
                  </div>
                )}
              </div>

              {/* Re-analyze Button */}
              {candidates.length > 0 && (
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
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

          {/* Upload Zone Card */}
          <Card className="shrink-0">
            <CardContent className="p-4 space-y-2">
              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">
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

        {/* Right Column (Candidates & Rankings) — 8 of 12 cols, fixed toolbar & dedicated resume list scrolling */}
        <div className="lg:col-span-8 flex flex-col min-h-0 overflow-hidden h-full space-y-3">
          {processingStatus && (processingStatus.inProgress > 0 || processingStatus.queued > 0) && (
            <div className="shrink-0">
              <ProcessingStatusBar status={processingStatus} />
            </div>
          )}

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
