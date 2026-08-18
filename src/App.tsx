import { useEffect, useState } from 'react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import { AppShell } from './components/layout/AppShell';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { JobsPage } from './pages/JobsPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { JobForm } from './components/jobs/JobForm';
import { CandidateDetailPage } from './pages/CandidateDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { useCandidateStore } from './stores/useCandidateStore';
import { useSettingsStore } from './stores/useSettingsStore';
import { api } from './lib/tauri';
import { CandidateAnalysisCompleteEvent } from './types/processing';

export function App() {
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const { handleAnalysisComplete } = useCandidateStore();
  const { setDownloadProgress, setDownloadError, fetchModels } = useSettingsStore();

  useEffect(() => {
    // Check onboarding status from settings
    api.settings.getAll().then((settings) => {
      setOnboardingCompleted(settings.onboarding_completed === 'true');
    }).catch(() => {
      setOnboardingCompleted(false);
    });

    // Tauri Event Listeners
    let unlistenAnalysis: (() => void) | undefined;
    let unlistenProgress: (() => void) | undefined;
    let unlistenComplete: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    listen<CandidateAnalysisCompleteEvent>('candidate-analysis-complete', (event) => {
      handleAnalysisComplete(event.payload);
    }).then((unlisten) => {
      unlistenAnalysis = unlisten;
    });

    listen<any>('model-download-progress', (event) => {
      const { model_id, downloaded_bytes, total_bytes, speed_bps } = event.payload;
      setDownloadProgress({
        modelId: model_id,
        downloaded: downloaded_bytes,
        total: total_bytes,
        speedBps: speed_bps,
      });
    }).then((unlisten) => {
      unlistenProgress = unlisten;
    });

    listen<any>('model-download-complete', () => {
      setDownloadProgress(null);
      setDownloadError(null);
      fetchModels();
    }).then((unlisten) => {
      unlistenComplete = unlisten;
    });

    listen<any>('model-download-error', (event) => {
      const { model_id, error } = event.payload;
      setDownloadProgress(null);
      setDownloadError({ modelId: model_id, message: error || 'Model download failed' });
      fetchModels();
    }).then((unlisten) => {
      unlistenError = unlisten;
    });

    return () => {
      if (unlistenAnalysis) unlistenAnalysis();
      if (unlistenProgress) unlistenProgress();
      if (unlistenComplete) unlistenComplete();
      if (unlistenError) unlistenError();
    };
  }, [handleAnalysisComplete, setDownloadProgress, setDownloadError, fetchModels]);

  if (onboardingCompleted === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
        Initializing HireLens...
      </div>
    );
  }

  return (
    <MemoryRouter initialEntries={[onboardingCompleted ? '/' : '/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/new" element={<JobForm />} />
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
          <Route path="/jobs/:jobId/edit" element={<JobForm />} />
          <Route path="/jobs/:jobId/candidates/:candidateId" element={<CandidateDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MemoryRouter>
  );
}

export default App;
