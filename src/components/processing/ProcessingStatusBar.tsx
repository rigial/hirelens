import { Loader2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { ProcessingStatus } from '../../types/processing';
import { Progress } from '../ui/Progress';
import { formatEstimatedTime } from '../../lib/utils';

interface ProcessingStatusBarProps {
  status: ProcessingStatus | null;
}

export function ProcessingStatusBar({ status }: ProcessingStatusBarProps) {
  if (!status || (status.inProgress === 0 && status.queued === 0)) {
    return null;
  }

  const activeRemaining = status.inProgress + status.queued;
  const total = status.total || 1;
  const processed = status.completed + status.failed;
  const percentage = Math.round((processed / total) * 100);

  // Approximate ~8 seconds per resume analysis on average with local model
  const estimatedSeconds = activeRemaining * 8;
  const etaFormatted = formatEstimatedTime(estimatedSeconds);

  return (
    <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3.5 space-y-2 mb-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-semibold text-indigo-950">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          <span>
            Analyzing resumes... ({processed} of {total} completed)
          </span>
          {etaFormatted && (
            <span className="text-[11px] font-medium text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full border border-indigo-200/60 inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {etaFormatted}
            </span>
          )}
        </div>
        <span className="font-bold text-indigo-700">{percentage}%</span>
      </div>

      <Progress value={percentage} indicatorClassName="bg-indigo-600" />

      <div className="flex items-center justify-between text-[11px] text-indigo-800/80">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" /> {status.completed} successful
        </span>
        {status.failed > 0 && (
          <span className="flex items-center gap-1 text-rose-600 font-medium">
            <AlertTriangle className="h-3 w-3" /> {status.failed} failed
          </span>
        )}
        <span>{activeRemaining} remaining in queue</span>
      </div>
    </div>
  );
}

