import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  FileText,
  Briefcase,
  GraduationCap,
  ExternalLink,
  Check,
  X,
  RotateCcw,
  FileWarning,
  Copy,
  AlertCircle,
  Eye,
  Code,
  Loader2,
} from 'lucide-react';
import { CandidateDetail as CandidateDetailType } from '../../types/candidate';
import { ScoreBreakdown } from './ScoreBreakdown';
import { AISummary } from './AISummary';
import { SkillMatchBadge } from './SkillMatchBadge';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { getScoreColor, formatResumeText } from '../../lib/utils';
import { api } from '../../lib/tauri';

interface CandidateDetailProps {
  candidate: CandidateDetailType;
  jobId: string;
  onUpdateStatus: (status: string, notes?: string) => Promise<void>;
}

/**
 * Renders a candidate’s detailed review page for a job, including match analysis, resume text, and review actions.
 *
 * @param candidate - The candidate and their analysis, resume, and shortlist information
 * @param jobId - The identifier of the associated job
 * @param onUpdateStatus - Updates the candidate’s shortlist status and review notes
 */
export function CandidateDetail({ candidate, jobId, onUpdateStatus }: CandidateDetailProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'analysis' | 'resume'>('analysis');
  const [resumeViewMode, setResumeViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [notes, setNotes] = useState(candidate.shortlistNotes || '');
  const [isOpeningFile, setIsOpeningFile] = useState(false);
  const [openFileError, setOpenFileError] = useState<string | null>(null);
  const [isCopiedPath, setIsCopiedPath] = useState(false);
  const [isCopiedText, setIsCopiedText] = useState(false);

  const formattedResumeText = useMemo(() => {
    return candidate.rawText ? formatResumeText(candidate.rawText) : '';
  }, [candidate.rawText]);

  const analysis = candidate.analysis;
  const scoreColors = analysis ? getScoreColor(analysis.scores.overallScore) : null;
  const isScannedDoc = Boolean(
    candidate.resumeError && (
      candidate.resumeError.toLowerCase().includes('scanned') ||
      candidate.resumeError.toLowerCase().includes('no extractable text') ||
      candidate.resumeError.toLowerCase().includes('text layer')
    )
  );
  const isOtherError = Boolean(candidate.resumeError && !isScannedDoc);

  const handleStatusChange = async (status: string) => {
    await onUpdateStatus(status, notes);
  };

  const handleOpenOriginalFile = async () => {
    if (!candidate.filePath) {
      setOpenFileError('No local file path recorded for this candidate.');
      setTimeout(() => setOpenFileError(null), 5000);
      return;
    }
    setIsOpeningFile(true);
    setOpenFileError(null);
    try {
      await api.system.openPath(candidate.filePath);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to open original file';
      setOpenFileError(msg);
      setTimeout(() => setOpenFileError(null), 6000);
    } finally {
      setIsOpeningFile(false);
    }
  };

  const handleCopyFilePath = async () => {
    if (!candidate.filePath) return;
    try {
      await navigator.clipboard.writeText(candidate.filePath);
      setIsCopiedPath(true);
      setTimeout(() => setIsCopiedPath(false), 2000);
    } catch {
      setOpenFileError('Failed to copy file path to clipboard');
      setTimeout(() => setOpenFileError(null), 5000);
    }
  };

  const handleCopyResumeText = async () => {
    const textToCopy = resumeViewMode === 'formatted' ? formattedResumeText : candidate.rawText || '';
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopiedText(true);
      setTimeout(() => setIsCopiedText(false), 2000);
    } catch {
      setOpenFileError('Failed to copy resume text to clipboard');
      setTimeout(() => setOpenFileError(null), 5000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Navigation */}
      <button
        onClick={() => navigate(`/jobs/${jobId}`)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Candidate List
      </button>

      {/* Scanned PDF Warning Banner */}
      {isScannedDoc && !analysis && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs shadow-xs">
          <FileWarning className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-900 text-sm">Scanned Document Warning: No Extractable Text Layer</h4>
            <p className="leading-relaxed text-amber-800">
              This document (<span className="font-medium">{candidate.fileName}</span>) contains no extractable text. It appears to be an image-only scan or flattened PDF.
              Please apply OCR to the document or upload a text-based PDF or Word document (.docx) to enable automatic skill extraction and match scoring.
            </p>
          </div>
        </div>
      )}

      {/* General Processing Error Banner */}
      {isOtherError && !analysis && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs shadow-xs">
          <FileWarning className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-rose-900 text-sm">Document Processing Error</h4>
            <p className="leading-relaxed text-rose-800">
              {candidate.resumeError}
            </p>
          </div>
        </div>
      )}

      {/* Main Candidate Card Header */}
      <Card className="border-slate-200/90 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Candidate Identity */}
            <div className="flex items-start gap-4">
              {analysis && (
                <div
                  className={`h-16 w-16 rounded-2xl flex flex-col items-center justify-center font-extrabold border shrink-0 ${scoreColors?.bg} ${scoreColors?.border}`}
                >
                  <span className={`text-2xl font-black ${scoreColors?.text}`}>
                    {analysis.scores.overallScore.toFixed(0)}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">
                    Rank #{analysis.rank}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">{candidate.name}</h1>
                  <Badge
                    variant={
                      candidate.shortlistStatus === 'shortlisted'
                        ? 'success'
                        : candidate.shortlistStatus === 'rejected'
                        ? 'destructive'
                        : 'secondary'
                    }
                    className="capitalize text-xs font-semibold"
                  >
                    {candidate.shortlistStatus === 'shortlisted'
                      ? 'Shortlisted'
                      : candidate.shortlistStatus === 'rejected'
                      ? 'Rejected'
                      : 'Pending Review'}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  {candidate.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      {candidate.email}
                    </span>
                  )}
                  {candidate.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {candidate.phone}
                    </span>
                  )}
                  {candidate.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {candidate.location}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant={candidate.shortlistStatus === 'shortlisted' ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => handleStatusChange(candidate.shortlistStatus === 'shortlisted' ? 'pending' : 'shortlisted')}
                className="gap-1.5"
              >
                {candidate.shortlistStatus === 'shortlisted' ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" /> Undo Shortlist
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" /> Shortlist
                  </>
                )}
              </Button>

              <Button
                variant={candidate.shortlistStatus === 'rejected' ? 'secondary' : 'destructive'}
                size="sm"
                onClick={() => handleStatusChange(candidate.shortlistStatus === 'rejected' ? 'pending' : 'rejected')}
                className="gap-1.5"
              >
                {candidate.shortlistStatus === 'rejected' ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" /> Undo Reject
                  </>
                ) : (
                  <>
                    <X className="h-3.5 w-3.5" /> Reject
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('analysis')}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'analysis'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          AI Match & Score Analysis
        </button>
        <button
          onClick={() => setActiveTab('resume')}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'resume'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Parsed Resume Text
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'analysis' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Details & Qualitative */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Summary */}
            {analysis && (
              <AISummary
                summary={analysis.aiSummary}
                strengths={analysis.strengths}
                concerns={analysis.concerns}
              />
            )}

            {/* Skills Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Skills Evaluation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Matched Required */}
                {analysis && analysis.matchedSkills.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                      Matched Skills
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.matchedSkills.map((s, idx) => (
                        <SkillMatchBadge key={idx} skill={s} matched={true} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Skills */}
                {analysis && analysis.missingSkills.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <h5 className="text-xs font-semibold text-rose-700 uppercase tracking-wide">
                      Missing Job Requirements
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.missingSkills.map((s, idx) => (
                        <SkillMatchBadge key={idx} skill={s} matched={false} />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Work History & Education */}
            {analysis && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Education */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xs uppercase flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4 text-indigo-600" /> Education
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    {analysis.education.length > 0 ? (
                      analysis.education.map((edu, idx) => (
                        <div key={idx} className="bg-slate-50 p-2.5 rounded-lg">
                          <p className="font-semibold text-slate-900">{edu.degree}</p>
                          <p className="text-slate-500">{edu.institution}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400">Education not explicitly specified</p>
                    )}
                  </CardContent>
                </Card>

                {/* Work Experience */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xs uppercase flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4 text-indigo-600" /> Experience Level
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-lg">
                      <p className="font-semibold text-slate-900">
                        {analysis.experienceYears !== null && analysis.experienceYears !== undefined
                          ? `${analysis.experienceYears} Years Estimated`
                          : 'Not specified'}
                      </p>
                      <p className="text-slate-500">Calculated from chronological career entries</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Right 1 Col: Score Breakdown & Review Notes */}
          <div className="space-y-6">
            {analysis && <ScoreBreakdown scores={analysis.scores} />}

            {/* Review Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xs uppercase">Internal HR Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  rows={4}
                  placeholder="Add private evaluation notes or interview discussion points..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusChange(candidate.shortlistStatus)}
                  className="w-full text-xs"
                >
                  Save Notes
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Resume Text Tab */
        <div className="space-y-4">
          {openFileError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Unable to open original file: </span>
                <span>{openFileError}</span>
              </div>
            </div>
          )}

          <Card className="border-slate-200/90 shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="space-y-1 min-w-0">
                <CardTitle className="text-sm flex items-center gap-2 text-slate-900 truncate">
                  <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span className="truncate">{candidate.fileName}</span>
                </CardTitle>
                {candidate.filePath && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono truncate">
                    <span className="truncate">{candidate.filePath}</span>
                    <button
                      type="button"
                      onClick={handleCopyFilePath}
                      title="Copy full file path"
                      className="p-1 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                    >
                      {isCopiedPath ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* View Mode Toggle */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setResumeViewMode('formatted')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      resumeViewMode === 'formatted'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" /> Formatted
                  </button>
                  <button
                    type="button"
                    onClick={() => setResumeViewMode('raw')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      resumeViewMode === 'raw'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Code className="h-3.5 w-3.5" /> Raw Text
                  </button>
                </div>

                {/* Copy Text Button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyResumeText}
                  className="gap-1.5 text-xs"
                >
                  {isCopiedText ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy Text
                    </>
                  )}
                </Button>

                {/* Open Original File Button */}
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleOpenOriginalFile}
                  disabled={isOpeningFile || !candidate.filePath}
                  className="gap-1.5 text-xs font-semibold"
                >
                  {isOpeningFile ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Opening...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-3.5 w-3.5" /> Open Original File
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {resumeViewMode === 'formatted' ? (
                <div className="text-sm font-sans text-slate-800 leading-relaxed whitespace-pre-wrap break-words bg-slate-50/70 p-6 rounded-xl border border-slate-200/80 max-h-[650px] overflow-y-auto select-text space-y-3">
                  {formattedResumeText ? (
                    formattedResumeText
                  ) : (
                    <p className="text-xs text-slate-400 italic">No text extracted for this resume.</p>
                  )}
                </div>
              ) : (
                <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words leading-relaxed bg-slate-50 p-6 rounded-xl border border-slate-200 max-h-[650px] overflow-y-auto select-text">
                  {candidate.rawText || 'No text extracted for this resume.'}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
