import { useEffect } from 'react';
import { HardDrive, ShieldCheck, Info } from 'lucide-react';
import { ModelSelector } from '../components/settings/ModelSelector';
import { ConcurrencySettings } from '../components/settings/ConcurrencySettings';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useSettingsStore } from '../stores/useSettingsStore';
import { APP_NAME, APP_TAGLINE } from '../lib/constants';

export function SettingsPage() {
  const { fetchSettings, fetchModels, fetchSystemInfo } = useSettingsStore();

  useEffect(() => {
    fetchSettings();
    fetchModels();
    fetchSystemInfo();
  }, [fetchSettings, fetchModels, fetchSystemInfo]);

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
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700">
              ~/.hirelens/hirelens.db
            </div>
            <div className="flex items-center gap-2 text-emerald-700 font-medium pt-1">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
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
