import { formatBytes, formatEstimatedTime } from '../../lib/utils';
import { ModelDownloadProgress } from '../../stores/useSettingsStore';

export interface DownloadStatusFooterProps {
  progress: ModelDownloadProgress | null;
  statusSubtitle?: string;
  sizeVariant?: 'sm' | 'md';
}

export function DownloadStatusFooter({
  progress,
  statusSubtitle = 'Screen kept awake • Background download active',
  sizeVariant = 'sm',
}: DownloadStatusFooterProps) {
  const isSmall = sizeVariant === 'sm';

  return (
    <div className="space-y-1.5">
      <div
        className={`flex justify-between items-center ${
          isSmall ? 'text-[10px]' : 'text-[11px]'
        } text-neutral-500 dark:text-neutral-400 font-mono`}
      >
        <span>
          {progress && progress.total > 0
            ? `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)}`
            : isSmall
            ? 'Connecting...'
            : 'Preparing stream...'}
        </span>
        <div className={`flex items-center ${isSmall ? 'gap-1.5' : 'gap-2'} font-medium`}>
          {progress &&
            progress.etaSeconds !== undefined &&
            progress.etaSeconds !== null &&
            progress.etaSeconds > 0 && (
              <span
                className={`text-neutral-900 dark:text-white font-semibold bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded ${
                  isSmall ? 'text-[9px]' : 'text-[10px]'
                }`}
              >
                {formatEstimatedTime(progress.etaSeconds)}
              </span>
            )}
          <span>
            {progress && progress.speedBps > 0
              ? `${formatBytes(progress.speedBps)}/s`
              : isSmall
              ? '—'
              : 'Connecting...'}
          </span>
        </div>
      </div>
      <div
        className={`flex items-center ${
          isSmall ? 'gap-1 text-[9px]' : 'gap-1.5 text-[10px]'
        } text-neutral-400 dark:text-neutral-500 justify-center pt-0.5`}
      >
        <span
          className={`${
            isSmall ? 'h-1 w-1' : 'h-1.5 w-1.5'
          } rounded-full bg-neutral-900 dark:bg-white animate-pulse`}
        />
        <span>{statusSubtitle}</span>
      </div>
    </div>
  );
}
