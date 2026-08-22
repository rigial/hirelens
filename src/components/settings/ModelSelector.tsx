import { HardDrive, CheckCircle2, Download, Loader2, XCircle, AlertCircle } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { MODEL_TIER_CONFIG } from '../../lib/constants';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Progress } from '../ui/Progress';
import { formatBytes, formatEstimatedTime, cn } from '../../lib/utils';
import { ModelTier } from '../../types/settings';

export function ModelSelector() {
  const {
    models,
    systemInfo,
    downloadProgress,
    downloadError,
    downloadModel,
    cancelModelDownload,
    setActiveModel,
  } = useSettingsStore();

  const handleDownload = async (modelId: string) => {
    await downloadModel(modelId);
  };

  const handleCancel = async (modelId: string) => {
    await cancelModelDownload(modelId);
  };

  const handleActivate = async (modelId: string) => {
    await setActiveModel(modelId);
  };

  const isAnyModelDownloading = models.some(
    (m) => m.status === 'downloading' || (!!downloadProgress?.modelId && downloadProgress.modelId === m.id)
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {(['fast', 'balanced', 'quality'] as ModelTier[]).map((tier) => {
          const config = MODEL_TIER_CONFIG[tier];
          const model = models.find((m) => m.tier === tier);
          const isRecommended = systemInfo?.recommendedModelTier === tier;
          const isActive = model?.isActive;
          const isDownloaded = model?.status === 'downloaded';
          const isCurrentDownloading =
            !!model && (model.status === 'downloading' || downloadProgress?.modelId === model.id);
          const currentProgress =
            model && downloadProgress?.modelId === model.id ? downloadProgress : null;
          const modelError =
            model && downloadError?.modelId === model.id ? downloadError.message : null;

          const percent =
            currentProgress && currentProgress.total > 0
              ? Math.min(
                  100,
                  Math.round(
                    (currentProgress.downloaded / currentProgress.total) * 100
                  )
                )
              : null;

          return (
            <Card
              key={tier}
              className={cn(
                'relative transition-all border-2 flex flex-col justify-between',
                isActive ? 'border-neutral-900 dark:border-white bg-neutral-100/50 dark:bg-neutral-800/70 shadow-2xs' : 'border-neutral-200/90 dark:border-neutral-800'
              )}
            >
              <CardContent className="p-4 space-y-3 flex flex-col justify-between flex-1">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-950 dark:text-white text-sm">{config.label}</span>
                    <div className="flex gap-1">
                      {isRecommended && (
                        <Badge variant="default" className="text-[10px]">
                          Recommended
                        </Badge>
                      )}
                      {isActive && (
                        <Badge variant="secondary" className="text-[10px] font-semibold">
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    <HardDrive className="h-3.5 w-3.5" />
                    <span>{config.size}</span>
                  </div>

                  <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed min-h-[36px]">
                    {config.notes}
                  </p>

                  {/* Live Download Progress Box */}
                  {isCurrentDownloading && (
                    <div className="space-y-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-2.5">
                      <div className="flex justify-between items-center text-[11px] font-semibold text-neutral-800 dark:text-neutral-200">
                        <span className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin text-neutral-900 dark:text-white" />
                          Downloading...
                        </span>
                        <span className="font-mono text-neutral-900 dark:text-white font-bold">
                          {percent !== null ? `${percent}%` : 'Starting...'}
                        </span>
                      </div>
                      <Progress value={percent !== null ? percent : 5} />
                      <div className="flex justify-between items-center text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                        <span>
                          {currentProgress
                            ? `${formatBytes(currentProgress.downloaded)} / ${formatBytes(currentProgress.total)}`
                            : 'Connecting...'}
                        </span>
                        <div className="flex items-center gap-1.5 font-medium">
                          {currentProgress && currentProgress.etaSeconds !== undefined && currentProgress.etaSeconds !== null && currentProgress.etaSeconds > 0 && (
                            <span className="text-neutral-900 dark:text-white font-semibold bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded text-[9px]">
                              {formatEstimatedTime(currentProgress.etaSeconds)}
                            </span>
                          )}
                          <span>
                            {currentProgress && currentProgress.speedBps > 0
                              ? `${formatBytes(currentProgress.speedBps)}/s`
                              : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-neutral-400 dark:text-neutral-500 justify-center pt-0.5">
                        <span className="h-1 w-1 rounded-full bg-neutral-900 dark:bg-white animate-pulse" />
                        <span>Screen kept awake • Background download active</span>
                      </div>
                    </div>
                  )}

                  {/* Error Notification */}
                  {modelError && (
                    <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 flex items-start gap-1.5 text-[11px] text-neutral-900 dark:text-neutral-100">
                      <AlertCircle className="h-3.5 w-3.5 text-neutral-900 dark:text-white shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{modelError}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  {isActive ? (
                    <div className="flex items-center justify-center gap-1 text-xs text-neutral-900 dark:text-white font-semibold py-1">
                      <CheckCircle2 className="h-4 w-4" /> Currently Active
                    </div>
                  ) : isCurrentDownloading ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => model && handleCancel(model.id)}
                      className="w-full text-xs gap-1"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancel Download
                    </Button>
                  ) : isDownloaded ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => model && handleActivate(model.id)}
                      disabled={isAnyModelDownloading}
                      className="w-full text-xs"
                    >
                      Set as Active
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => model && handleDownload(model.id)}
                      disabled={isAnyModelDownloading}
                      className="w-full text-xs gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Model
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
