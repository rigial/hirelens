import { useEffect, useState, useCallback } from 'react';
import { HardDrive, ShieldCheck, Info, FolderOpen, Copy, Check, AlertCircle, RotateCcw } from 'lucide-react';
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
  const [isLoadingDir, setIsLoadingDir] = useState(false);
  const [dirError, setDirError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const fetchAppDataDir = useCallback(async () => {
    setIsLoadingDir(true);
    setDirError(null);
    try {
      const dir = await api.settings.getAppDataDir();
      setAppDataDir(dir);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to load storage path';
      setDirError(msg);
    } finally {
      setIsLoadingDir(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchModels();
    fetchSystemInfo();
    fetchAppDataDir();
  }, [fetchSettings, fetchModels, fetchSystemInfo, fetchAppDataDir]);

  const handleOpenDatabaseDir = async () => {
    if (!appDataDir) return;
    setIsOpening(true);
    setActionError(null);
    try {
      await api.system.openPath(appDataDir);
    } catch {
      try {
        await openPath(appDataDir);
      } catch (err: any) {
        const msg = typeof err === 'string' ? err : err?.message || 'Failed to open directory in file explorer';
        setActionError(msg);
        setTimeout(() => setActionError(null), 5000);
      }
    } finally {
      setIsOpening(false);
    }
  };

  const handleCopyPath = async () => {
    if (!appDataDir) return;
    setActionError(null);
    try {
      await navigator.clipboard.writeText(`${appDataDir}/hirelens.db`);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to copy path to clipboard';
      setActionError(msg);
      setTimeout(() => setActionError(null), 5000);
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

            {dirError ? (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-rose-800">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span className="text-xs truncate">{dirError}</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={fetchAppDataDir}
                  disabled={isLoadingDir}
                  className="gap-1 text-xs shrink-0"
                >
                  <RotateCcw className={`h-3 w-3 ${isLoadingDir ? 'animate-spin' : ''}`} />
                  <span>Retry</span>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 break-all select-all flex items-center justify-between gap-2">
                  <span>{isLoadingDir ? 'Loading storage path...' : appDataDir ? `${appDataDir}/hirelens.db` : 'No storage path detected'}</span>
                  {appDataDir && (
                    <button
                      onClick={handleCopyPath}
                      title="Copy full database file path"
                      className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200 transition-colors shrink-0 cursor-pointer"
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
                  <span>{isOpening ? 'Opening...' : 'Open in Finder / Explorer'}</span>
                </Button>
              </div>
            )}

            {actionError && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-amber-800 text-xs">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

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
          <p className="leading-relaxed text-slate-600">
            Copyright © {new Date().getFullYear()}. All rights reserved —{' '}
            <a
              href="https://rigial.com/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                api.system.openPath('https://rigial.com/');
              }}
              className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium cursor-pointer"
            >
              Rigial.com
            </a>{' '}
            |{' '}
            <a
              href="https://www.linkedin.com/in/mrkishorekumar/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                api.system.openPath('https://www.linkedin.com/in/mrkishorekumar/');
              }}
              className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium cursor-pointer"
            >
              M R Kishore Kumar
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
