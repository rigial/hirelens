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
  const processed = status.completed + status.failed;
  const total = status.total > 0 ? status.total : processed + activeRemaining > 0 ? processed + activeRemaining : 1;
  const percentage = total > 0 ? Math.min(100, Math.max(0, Math.round((processed / total) * 100))) : 0;

  // Approximate ~8 seconds per resume analysis on average with local model
  const estimatedSeconds = activeRemaining * 8;
  const etaFormatted = formatEstimatedTime(estimatedSeconds);

  return (
    <div className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 space-y-2 mb-4 animate-in fade-in duration-300 transition-colors">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-900 dark:text-white shrink-0" />
          <span>
            {status.failed > 0
              ? `Analyzing resumes... (${processed} of ${total} processed)`
              : `Analyzing resumes... (${status.completed} of ${total} completed)`}
          </span>
          {etaFormatted && (
            <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-200/80 dark:bg-neutral-800 px-2 py-0.5 rounded-full border border-neutral-300/80 dark:border-neutral-700 inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {etaFormatted}
            </span>
          )}
        </div>
        <span className="font-bold text-neutral-950 dark:text-white font-mono">{percentage}%</span>
      </div>

      <Progress value={percentage} indicatorClassName="bg-neutral-900 dark:bg-white" />

      <div className="flex items-center justify-between text-[11px] text-neutral-600 dark:text-neutral-400">
        <span className="flex items-center gap-1 font-medium text-neutral-900 dark:text-neutral-100">
          <CheckCircle2 className="h-3 w-3 text-neutral-900 dark:text-white" /> {status.completed} successful
        </span>
        {status.failed > 0 && (
          <span className="flex items-center gap-1 text-neutral-900 dark:text-white font-semibold">
            <AlertTriangle className="h-3 w-3" /> {status.failed} failed
          </span>
        )}
        <span>
          {status.inProgress > 0 && status.queued > 0
            ? `${status.inProgress} in progress, ${status.queued} queued`
            : `${activeRemaining} remaining`}
        </span>
      </div>
    </div>
  );
}
