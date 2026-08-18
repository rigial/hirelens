import { useState } from 'react';
import { HardDrive, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { MODEL_TIER_CONFIG } from '../../lib/constants';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Progress } from '../ui/Progress';
import { formatBytes, cn } from '../../lib/utils';
import { ModelTier } from '../../types/settings';

export function ModelSelector() {
  const {
    models,
    systemInfo,
    downloadProgress,
    downloadModel,
    setActiveModel,
  } = useSettingsStore();

  const [downloadingTier, setDownloadingTier] = useState<string | null>(null);

  const handleDownload = async (modelId: string, tier: string) => {
    setDownloadingTier(tier);
    try {
      await downloadModel(modelId);
    } finally {
      setDownloadingTier(null);
    }
  };

  const handleActivate = async (modelId: string) => {
    await setActiveModel(modelId);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {(['fast', 'balanced', 'quality'] as ModelTier[]).map((tier) => {
          const config = MODEL_TIER_CONFIG[tier];
          const model = models.find((m) => m.tier === tier);
          const isRecommended = systemInfo?.recommendedModelTier === tier;
          const isActive = model?.isActive;
          const isDownloaded = model?.status === 'downloaded';
          const isCurrentDownloading = downloadingTier === tier;

          return (
            <Card
              key={tier}
              className={cn(
                'relative transition-all border-2',
                isActive ? 'border-indigo-600 bg-indigo-50/20 shadow-xs' : 'border-slate-200/80'
              )}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{config.label}</span>
                  <div className="flex gap-1">
                    {isRecommended && (
                      <Badge variant="indigo" className="text-[10px]">
                        Recommended
                      </Badge>
                    )}
                    {isActive && (
                      <Badge variant="success" className="text-[10px]">
                        Active
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                  <span>{config.size}</span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed min-h-[36px]">
                  {config.notes}
                </p>

                {isCurrentDownloading && downloadProgress && (
                  <div className="space-y-1.5 pt-1">
                    <Progress
                      value={(downloadProgress.downloaded / (downloadProgress.total || 1)) * 100}
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{formatBytes(downloadProgress.downloaded)}</span>
                      <span>{formatBytes(downloadProgress.speedBps)}/s</span>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100">
                  {isActive ? (
                    <div className="flex items-center justify-center gap-1 text-xs text-emerald-600 font-semibold py-1">
                      <CheckCircle2 className="h-4 w-4" /> Currently Active
                    </div>
                  ) : isDownloaded ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => model && handleActivate(model.id)}
                      className="w-full text-xs"
                    >
                      Set as Active
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => model && handleDownload(model.id, tier)}
                      disabled={isCurrentDownloading}
                      className="w-full text-xs gap-1.5"
                    >
                      {isCurrentDownloading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5" /> Download
                        </>
                      )}
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
