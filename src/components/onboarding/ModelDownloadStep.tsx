import { useState, useEffect } from 'react';
import { CheckCircle2, Download, HardDrive, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { MODEL_TIER_CONFIG } from '../../lib/constants';
import { formatBytes, cn } from '../../lib/utils';
import { ModelTier } from '../../types/settings';

interface ModelDownloadStepProps {
  onComplete: () => void;
}

export function ModelDownloadStep({ onComplete }: ModelDownloadStepProps) {
  const {
    models,
    systemInfo,
    downloadProgress,
    fetchModels,
    fetchSystemInfo,
    downloadModel,
    setActiveModel,
    saveSetting,
  } = useSettingsStore();

  const [selectedTier, setSelectedTier] = useState<ModelTier>('balanced');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);

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

  const handleStartDownload = async () => {
    if (!selectedModel) return;
    setIsDownloading(true);
    try {
      await downloadModel(selectedModel.id);
      await setActiveModel(selectedModel.id);
      setIsDownloaded(true);
      setIsDownloading(false);
    } catch {
      setIsDownloading(false);
    }
  };

  const handleFinish = async () => {
    await saveSetting('onboarding_completed', 'true');
    onComplete();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-center py-4">
      <div className="space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Choose your Local AI Model
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          HireLens uses local weights to ensure candidate data privacy. Select the tier best suited for your computer.
        </p>
      </div>

      {/* Model Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-left">
        {(['fast', 'balanced', 'quality'] as ModelTier[]).map((tier) => {
          const config = MODEL_TIER_CONFIG[tier];
          const isRecommended = systemInfo?.recommendedModelTier === tier;
          const isSelected = selectedTier === tier;

          return (
            <Card
              key={tier}
              onClick={() => !isDownloading && !isDownloaded && setSelectedTier(tier)}
              className={cn(
                'cursor-pointer transition-all relative border-2',
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/20 shadow-sm'
                  : 'border-slate-200/80 hover:border-slate-300'
              )}
            >
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 text-sm">{config.label}</span>
                  {isRecommended && (
                    <Badge variant="indigo" className="text-[10px]">
                      Recommended
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                  <span>{config.size}</span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed min-h-[36px]">
                  {config.notes}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Progress & Action */}
      <div className="pt-4 max-w-md mx-auto space-y-4">
        {isDownloading && (
          <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-4 text-left">
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                Downloading {selectedModel?.displayName}...
              </span>
              <span>
                {downloadProgress
                  ? `${((downloadProgress.downloaded / (downloadProgress.total || 1)) * 100).toFixed(0)}%`
                  : 'Starting...'}
              </span>
            </div>
            <Progress
              value={downloadProgress ? (downloadProgress.downloaded / (downloadProgress.total || 1)) * 100 : 15}
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>{downloadProgress ? formatBytes(downloadProgress.downloaded) : '0 MB'}</span>
              <span>{downloadProgress ? `${formatBytes(downloadProgress.speedBps)}/s` : 'Connecting...'}</span>
            </div>
          </div>
        )}

        {isDownloaded ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-emerald-600 font-semibold text-sm">
              <CheckCircle2 className="h-5 w-5" /> Model configured successfully
            </div>
            <Button size="lg" onClick={handleFinish} className="w-full">
              Start Using HireLens
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            onClick={handleStartDownload}
            disabled={isDownloading}
            className="w-full gap-2"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? 'Downloading AI Engine...' : 'Download & Activate Model'}
          </Button>
        )}
      </div>
    </div>
  );
}
