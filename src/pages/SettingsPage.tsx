import { useEffect, useState } from 'react';
import { HardDrive, ShieldCheck, Info, FolderOpen, Copy, Check } from 'lucide-react';
import { openPath } from '@tauri-apps/plugin-opener';
import { ModelSelector } from '../components/settings/ModelSelector';
import { ConcurrencySettings } from '../components/settings/ConcurrencySettings';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useSettingsStore } from '../stores/useSettingsStore';
import { APP_NAME, APP_TAGLINE } from '../lib/constants';
import { api } from '../lib/tauri';

/**
 * Renders the settings screen for local AI models, worker concurrency, storage, privacy, and application information.
 *
 * @returns The settings page interface.
 */
export function SettingsPage() {
  const { fetchSettings, fetchModels, fetchSystemInfo } = useSettingsStore();
  const [appDataDir, setAppDataDir] = useState<string>('');
  const [isOpening, setIsOpening] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchModels();
    fetchSystemInfo();

    api.settings.getAppDataDir()
      .then((dir) => setAppDataDir(dir))
      .catch((err) => console.error('Failed to get app data dir:', err));
  }, [fetchSettings, fetchModels, fetchSystemInfo]);

  const handleOpenDatabaseDir = async () => {
    if (!appDataDir) return;
    setIsOpening(true);
    try {
      await openPath(appDataDir);
    } catch (err) {
      console.error('Failed to open app data directory:', err);
    } finally {
      setIsOpening(false);
    }
  };

  const handleCopyPath = async () => {
    if (!appDataDir) return;
    try {
      await navigator.clipboard.writeText(`${appDataDir}/hirelens.db`);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy path to clipboard:', err);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Settings & Local AI Models
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure on-device model weights, compute hardware concurrency, and local storage.
        </p>
      </div>

      {/* Model Selection */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
          Active Local AI Engine
        </h2>
        <ModelSelector />
      </div>

      {/* Hardware & Concurrency */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
          Worker Compute
        </h2>
        <ConcurrencySettings />
      </div>

      {/* Local Storage & Privacy */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
          Data Privacy & Storage
        </h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-indigo-600" /> Embedded SQLite Database
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-600">
            <p>
              All job criteria, candidate extractions, embeddings, and ranking metadata are persisted locally in SQLite on your disk.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 break-all select-all flex items-center justify-between gap-2">
                <span>{appDataDir ? `${appDataDir}/hirelens.db` : 'Loading storage path...'}</span>
                {appDataDir && (
                  <button
                    onClick={handleCopyPath}
                    title="Copy full database file path"
                    className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200 transition-colors shrink-0"
                  >
                    {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenDatabaseDir}
                disabled={!appDataDir || isOpening}
                className="gap-1.5 text-xs font-semibold whitespace-nowrap"
                title="Open hirelens database directory in system file explorer"
              >
                <FolderOpen className="h-3.5 w-3.5 text-indigo-600" />
                <span>Open in Finder / Explorer</span>
              </Button>
            </div>

            <div className="flex items-center gap-2 text-emerald-700 font-medium pt-1">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Offline isolation active — no telemetry or applicant data is transmitted.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* About Application */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4 text-indigo-600" /> About {APP_NAME}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-slate-600">
          <p className="font-semibold text-slate-900">
            {APP_NAME} v1.0.0 — {APP_TAGLINE}
          </p>
          <p className="leading-relaxed">
            Built with Tauri 2, Rust backend engine, SQLite relational vector store, and React frontend.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
