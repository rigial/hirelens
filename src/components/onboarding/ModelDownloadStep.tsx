import { useState, useEffect } from 'react';
import { CheckCircle2, Download, HardDrive, Sparkles, Loader2, AlertCircle, XCircle, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { MODEL_TIER_CONFIG } from '../../lib/constants';
import { formatBytes, formatEstimatedTime, cn } from '../../lib/utils';
import { ModelTier } from '../../types/settings';

interface ModelDownloadStepProps {
  onComplete: () => void;
}

export function ModelDownloadStep({ onComplete }: ModelDownloadStepProps) {
  const {
    models,
    systemInfo,
    downloadProgress,
    downloadError,
    fetchModels,
    fetchSystemInfo,
    downloadModel,
    cancelModelDownload,
    setActiveModel,
    saveSetting,
  } = useSettingsStore();

  const [selectedTier, setSelectedTier] = useState<ModelTier>('balanced');
  const [isStartingDownload, setIsStartingDownload] = useState(false);

  useEffect(() => {
    fetchModels();
    fetchSystemInfo();
  }, [fetchModels, fetchSystemInfo]);

  useEffect(() => {
    if (systemInfo?.recommendedModelTier) {
      setSelectedTier(systemInfo.recommendedModelTier);
    }
  }, [systemInfo]);

  const selectedModel = models.find((m) => m.tier === selectedTier) || models[0];

  const isDownloading =
    isStartingDownload ||
    (!!selectedModel &&
      (selectedModel.status === 'downloading' ||
        (!!downloadProgress?.modelId && downloadProgress.modelId === selectedModel.id)));

  const isDownloaded = selectedModel?.status === 'downloaded';

  // Automatically activate when download completes
  useEffect(() => {
    if (selectedModel?.status === 'downloaded' && !selectedModel.isActive) {
      setActiveModel(selectedModel.id);
    }
  }, [selectedModel?.status, selectedModel?.id, selectedModel?.isActive, setActiveModel]);

  const handleStartDownload = async () => {
    if (!selectedModel) return;
    setIsStartingDownload(true);
    try {
      await downloadModel(selectedModel.id);
    } finally {
      setIsStartingDownload(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedModel) return;
    setIsStartingDownload(false);
    await cancelModelDownload(selectedModel.id);
  };

  const handleFinish = async () => {
    if (selectedModel) {
      await setActiveModel(selectedModel.id);
    }
    await saveSetting('onboarding_completed', 'true');
    onComplete();
  };

  const handleSkipForNow = async () => {
    await saveSetting('onboarding_completed', 'true');
    onComplete();
  };

  const currentDownloadForSelected =
    selectedModel && downloadProgress?.modelId === selectedModel.id ? downloadProgress : null;

  const percent = currentDownloadForSelected && currentDownloadForSelected.total > 0
    ? Math.min(100, Math.round((currentDownloadForSelected.downloaded / currentDownloadForSelected.total) * 100))
    : null;

  const hasError = selectedModel && downloadError?.modelId === selectedModel.id ? downloadError.message : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-center py-4">
      <div className="space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
          Choose your Local AI Model
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-md mx-auto">
          HireLens runs open weights on your machine for complete candidate privacy. Select the tier best suited for your computer.
        </p>
      </div>

      {/* Model Selection Cards */}
      <div role="radiogroup" aria-label="Select local AI model tier" className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-left">
        {(['fast', 'balanced', 'quality'] as ModelTier[]).map((tier) => {
          const config = MODEL_TIER_CONFIG[tier];
          const model = models.find((m) => m.tier === tier);
          const isRecommended = systemInfo?.recommendedModelTier === tier;
          const isSelected = selectedTier === tier;
          const isTierDownloaded = model?.status === 'downloaded';
          const isTierDownloading =
            !!model && (model.status === 'downloading' || downloadProgress?.modelId === model.id);

          return (
            <Card
              key={tier}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isDownloading ? -1 : 0}
              onClick={() => !isDownloading && setSelectedTier(tier)}
              onKeyDown={(e) => {
                if (!isDownloading && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  setSelectedTier(tier);
                }
              }}
              className={cn(
                'cursor-pointer transition-all relative border-2 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:ring-offset-2',
                isSelected
                  ? 'border-neutral-900 dark:border-white bg-neutral-100/60 dark:bg-neutral-800/80 shadow-xs'
                  : 'border-neutral-200/90 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600',
                isDownloading && !isSelected && 'opacity-50 cursor-not-allowed'
              )}
            >
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-950 dark:text-white text-sm">{config.label}</span>
                  <div className="flex items-center gap-1">
                    {isRecommended && (
                      <Badge variant="default" className="text-[10px]">
                        Recommended
                      </Badge>
                    )}
                    {isTierDownloaded && (
                      <Badge variant="secondary" className="text-[10px] font-semibold">
                        Downloaded
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

                {isTierDownloading && (
                  <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-900 dark:text-white pt-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Downloading...</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Error Message Banner */}
      {hasError && (
        <div className="max-w-md mx-auto p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-left flex items-start gap-2.5 text-xs text-neutral-900 dark:text-neutral-100">
          <AlertCircle className="h-4 w-4 text-neutral-900 dark:text-white shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Download error: </span>
            <span>{hasError}</span>
          </div>
        </div>
      )}

      {/* Progress & Actions */}
      <div className="pt-2 max-w-md mx-auto space-y-4">
        {isDownloading && (
          <div className="space-y-3 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 text-left shadow-2xs">
            <div className="flex justify-between items-center text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-900 dark:text-white" />
                Downloading {selectedModel?.displayName || 'model'}...
              </span>
              <span className="text-neutral-900 dark:text-white font-mono font-bold">
                {percent !== null ? `${percent}%` : 'Connecting...'}
              </span>
            </div>

            <Progress
              value={percent !== null ? percent : 5}
            />

            <div className="flex justify-between items-center text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
              <span>
                {currentDownloadForSelected
                  ? `${formatBytes(currentDownloadForSelected.downloaded)} / ${formatBytes(currentDownloadForSelected.total)}`
                  : 'Preparing stream...'}
              </span>
              <div className="flex items-center gap-2">
                {currentDownloadForSelected && currentDownloadForSelected.etaSeconds !== undefined && currentDownloadForSelected.etaSeconds !== null && currentDownloadForSelected.etaSeconds > 0 && (
                  <span className="text-neutral-900 dark:text-white font-semibold bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded text-[10px]">
                    {formatEstimatedTime(currentDownloadForSelected.etaSeconds)}
                  </span>
                )}
                <span>
                  {currentDownloadForSelected && currentDownloadForSelected.speedBps > 0
                    ? `${formatBytes(currentDownloadForSelected.speedBps)}/s`
                    : 'Connecting...'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 dark:text-neutral-500 justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-900 dark:bg-white animate-pulse" />
              <span>Screen kept awake • Continues in background</span>
            </div>

            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="w-full text-xs gap-1.5"
              >
                <XCircle className="h-3.5 w-3.5" /> Cancel Download
              </Button>
            </div>
          </div>
        )}

        {isDownloaded ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-neutral-900 dark:text-white font-semibold text-sm">
              <CheckCircle2 className="h-5 w-5" /> Model configured and ready
            </div>
            <Button size="lg" onClick={handleFinish} className="w-full gap-2">
              Start Using HireLens <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : !isDownloading ? (
          <div className="space-y-2">
            <Button
              size="lg"
              onClick={handleStartDownload}
              className="w-full gap-2"
            >
              <Download className="h-4 w-4" />
              {hasError ? 'Retry Download' : 'Download & Activate Model'}
            </Button>

            <button
              type="button"
              onClick={handleSkipForNow}
              className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 underline pt-1 cursor-pointer"
            >
              Skip setup and configure models later in Settings
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
