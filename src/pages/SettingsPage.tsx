import { useEffect, useState, useCallback } from 'react';
import { HardDrive, ShieldCheck, Info, FolderOpen, Copy, Check, AlertCircle, RotateCcw, Laptop, Sun, Moon, Palette } from 'lucide-react';
import { ModelSelector } from '../components/settings/ModelSelector';
import { ConcurrencySettings } from '../components/settings/ConcurrencySettings';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useThemeStore, Theme } from '../stores/useThemeStore';
import { APP_NAME, APP_TAGLINE } from '../lib/constants';
import { api } from '../lib/tauri';

/**
 * Renders the settings screen for appearance & theme, local AI models, worker concurrency, storage, privacy, and application information.
 *
 * @returns The settings page interface.
 */
export function SettingsPage() {
  const { fetchSettings, fetchModels, fetchSystemInfo } = useSettingsStore();
  const { theme, setTheme } = useThemeStore();
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
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to open directory in file explorer';
      setActionError(msg);
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setIsOpening(false);
    }
  };

  const handleOpenUrl = async (url: string, e: React.MouseEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await api.system.openPath(url);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to open link';
      setActionError(msg);
      setTimeout(() => setActionError(null), 5000);
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

  const themeOptions: { value: Theme; label: string; description: string; icon: typeof Laptop }[] = [
    {
      value: 'system',
      label: 'System Default',
      description: "Automatically matches your operating system's light or dark mode preference.",
      icon: Laptop,
    },
    {
      value: 'light',
      label: 'Light Mode',
      description: 'Clean monochrome high-contrast dark elements on a crisp white background.',
      icon: Sun,
    },
    {
      value: 'dark',
      label: 'Dark Mode',
      description: 'Deep black background with crisp white typography and high-contrast surfaces.',
      icon: Moon,
    },
  ];

  return (
    <div className="h-full flex-1 overflow-y-auto overscroll-contain pr-1 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
          Settings & Local AI Models
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Configure appearance, on-device model weights, compute hardware concurrency, and local storage.
        </p>
      </div>

      {/* Appearance & Theme Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
          <h2 className="text-sm font-bold text-neutral-950 dark:text-white uppercase tracking-wide">
            Appearance & Theme
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5" role="radiogroup" aria-label="Appearance & Theme">
          {themeOptions.map((opt) => {
            const isSelected = theme === opt.value;
            const Icon = opt.icon;
            return (
              <Card
                key={opt.value}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => setTheme(opt.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setTheme(opt.value);
                  }
                }}
                className={`cursor-pointer transition-all border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white ${
                  isSelected
                    ? 'border-neutral-900 dark:border-white bg-neutral-100/60 dark:bg-neutral-800/80 shadow-2xs'
                    : 'border-neutral-200/90 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600'
                }`}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-neutral-950 dark:text-white text-sm">
                        {opt.label}
                      </span>
                    </div>
                    {isSelected && (
                      <Badge variant="default" className="text-[10px]">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed min-h-[36px]">
                    {opt.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-neutral-950 dark:text-white uppercase tracking-wide">
          Active Local AI Engine
        </h2>
        <ModelSelector />
      </div>

      {/* Hardware & Concurrency */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-neutral-950 dark:text-white uppercase tracking-wide">
          Worker Compute
        </h2>
        <ConcurrencySettings />
      </div>

      {/* Local Storage & Privacy */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-neutral-950 dark:text-white uppercase tracking-wide">
          Data Privacy & Storage
        </h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-neutral-700 dark:text-neutral-300" /> Embedded SQLite Database
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-neutral-600 dark:text-neutral-300">
            <p>
              All job criteria, candidate extractions, embeddings, and ranking metadata are persisted locally in SQLite on your disk.
            </p>

            {dirError ? (
              <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 flex items-center justify-between gap-3 text-neutral-900 dark:text-neutral-100">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="h-4 w-4 text-neutral-900 dark:text-white shrink-0" />
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
                <div className="flex-1 bg-neutral-100 dark:bg-neutral-800 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 font-mono text-[11px] text-neutral-900 dark:text-neutral-100 break-all select-all flex items-center justify-between gap-2">
                  <span>{isLoadingDir ? 'Loading storage path...' : appDataDir ? `${appDataDir}/hirelens.db` : 'No storage path detected'}</span>
                  {appDataDir && (
                    <button
                      onClick={handleCopyPath}
                      title="Copy full database file path"
                      className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors shrink-0 cursor-pointer"
                    >
                      {isCopied ? <Check className="h-3.5 w-3.5 text-neutral-900 dark:text-white" /> : <Copy className="h-3.5 w-3.5" />}
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
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span>{isOpening ? 'Opening...' : 'Open in Finder / Explorer'}</span>
                </Button>
              </div>
            )}

            {actionError && (
              <div className="p-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 flex items-center gap-2 text-neutral-900 dark:text-neutral-100 text-xs">
                <AlertCircle className="h-4 w-4 text-neutral-900 dark:text-white shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100 font-medium pt-1">
              <ShieldCheck className="h-4 w-4 text-neutral-900 dark:text-white shrink-0" />
              <span>Offline isolation active — no telemetry or applicant data is transmitted.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* About Application */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4 text-neutral-700 dark:text-neutral-300" /> About {APP_NAME}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
          <p className="font-semibold text-neutral-950 dark:text-white">
            {APP_NAME} v1.0.0 — {APP_TAGLINE}
          </p>
          <p className="leading-relaxed text-neutral-600 dark:text-neutral-400">
            Copyright © {new Date().getFullYear()}. All rights reserved —{' '}
            <a
              href="https://rigial.com/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => handleOpenUrl('https://rigial.com/', e)}
              className="text-neutral-900 dark:text-white hover:underline font-semibold cursor-pointer"
            >
              Rigial.com
            </a>{' '}
            — M R Kishore Kumar —{' '}
            <a
              href="https://www.linkedin.com/in/mrkishorekumar/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => handleOpenUrl('https://www.linkedin.com/in/mrkishorekumar/', e)}
              className="text-neutral-900 dark:text-white hover:underline font-semibold cursor-pointer"
            >
              LinkedIn
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
