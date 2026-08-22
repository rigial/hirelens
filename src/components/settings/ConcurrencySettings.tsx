import React, { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';

export function ConcurrencySettings() {
  const { settings, systemInfo, saveSetting } = useSettingsStore();
  const [concurrency, setConcurrency] = useState<number>(4);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings.concurrency) {
      setConcurrency(parseInt(settings.concurrency, 10));
    } else if (systemInfo) {
      setConcurrency(systemInfo.hasGpu ? 4 : 2);
    }
  }, [settings, systemInfo]);

  const handleSave = async () => {
    await saveSetting('concurrency', concurrency.toString());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Cpu className="h-4 w-4 text-neutral-700 dark:text-neutral-300" /> Background Worker Concurrency
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold text-neutral-800 dark:text-neutral-200">
            <span>Max Concurrent Resume Analyses</span>
            <span className="font-bold text-neutral-950 dark:text-white text-sm font-mono">{concurrency} workers</span>
          </div>

          <input
            type="range"
            min="1"
            max="8"
            step="1"
            value={concurrency}
            onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-neutral-900 dark:accent-white"
          />

          <div className="flex justify-between text-[11px] text-neutral-400 dark:text-neutral-500">
            <span>1 (Conservative)</span>
            <span>Recommended: {systemInfo?.hasGpu ? '4 (GPU)' : '2 (CPU)'}</span>
            <span>8 (Maximum)</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Hardware: {systemInfo?.cpuCores || 4} CPU Cores • {systemInfo?.gpuType || 'CPU'}
          </p>
          <Button size="sm" onClick={handleSave} className="text-xs">
            {saved ? 'Saved!' : 'Save Setting'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
