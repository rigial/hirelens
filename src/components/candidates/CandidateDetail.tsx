import { useState } from 'react';
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
} from 'lucide-react';
import { CandidateDetail as CandidateDetailType } from '../../types/candidate';
import { ScoreBreakdown } from './ScoreBreakdown';
import { AISummary } from './AISummary';
import { SkillMatchBadge } from './SkillMatchBadge';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { getScoreColor } from '../../lib/utils';

interface CandidateDetailProps {
  candidate: CandidateDetailType;
  jobId: string;
  onUpdateStatus: (status: string, notes?: string) => Promise<void>;
}

export function CandidateDetail({ candidate, jobId, onUpdateStatus }: CandidateDetailProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'analysis' | 'resume'>('analysis');
  const [notes, setNotes] = useState(candidate.shortlistNotes || '');

  const analysis = candidate.analysis;
  const scoreColors = analysis ? getScoreColor(analysis.scores.overallScore) : null;

  const handleStatusChange = async (status: string) => {
    await onUpdateStatus(status, notes);
  };

  const handleOpenOriginalFile = async () => {
    try {
      const { openPath } = await import('@tauri-apps/plugin-opener');
      await openPath(candidate.filePath);
    } catch {
      // Ignore
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" /> {candidate.fileName}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenOriginalFile}
              className="gap-1.5 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open Original File
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-x-auto max-h-[600px]">
              {candidate.rawText || 'No text extracted for this resume.'}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
