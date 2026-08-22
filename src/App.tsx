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
import { useThemeStore } from './stores/useThemeStore';
import { api } from './lib/tauri';
import { CandidateAnalysisCompleteEvent } from './types/processing';

interface ModelDownloadProgressPayload {
  model_id: string;
  downloaded_bytes: number;
  total_bytes: number;
  speed_bps: number;
  eta_seconds?: number;
}

interface ModelDownloadCompletePayload {
  model_id: string;
}

interface ModelDownloadErrorPayload {
  model_id: string;
  error: string;
}

interface ResumeFailedPayload {
  job_id: string;
  resume_id: string;
  error: string;
}

interface ResumeQueuePayload {
  job_id: string;
  resume_id: string;
}

export function App() {
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const handleAnalysisComplete = useCandidateStore((s) => s.handleAnalysisComplete);
  const handleAnalysisFailed = useCandidateStore((s) => s.handleAnalysisFailed);
  const handleProcessingUpdate = useCandidateStore((s) => s.handleProcessingUpdate);
  const setDownloadProgress = useSettingsStore((s) => s.setDownloadProgress);
  const setDownloadError = useSettingsStore((s) => s.setDownloadError);
  const fetchModels = useSettingsStore((s) => s.fetchModels);

  useEffect(() => {
    // Initialize Theme (System / Dark / Light) with system OS preference listener
    const cleanupTheme = useThemeStore.getState().initializeTheme();

    // Check onboarding status from settings
    api.settings.getAll().then((settings) => {
      setOnboardingCompleted(settings.onboarding_completed === 'true');
    }).catch(() => {
      setOnboardingCompleted(false);
    });

    // Tauri Event Listeners
    let unlistenAnalysis: (() => void) | undefined;
    let unlistenFailed: (() => void) | undefined;
    let unlistenQueued: (() => void) | undefined;
    let unlistenStarted: (() => void) | undefined;
    let unlistenProgress: (() => void) | undefined;
    let unlistenComplete: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    listen<CandidateAnalysisCompleteEvent>('candidate-analysis-complete', (event) => {
      handleAnalysisComplete(event.payload);
    }).then((unlisten) => {
      unlistenAnalysis = unlisten;
    });

    listen<ResumeFailedPayload>('resume-processing-failed', (event) => {
      handleAnalysisFailed(event.payload);
    }).then((unlisten) => {
      unlistenFailed = unlisten;
    });

    listen<ResumeQueuePayload>('resume-queued', (event) => {
      handleProcessingUpdate(event.payload.job_id);
    }).then((unlisten) => {
      unlistenQueued = unlisten;
    });

    listen<ResumeQueuePayload>('resume-processing-started', (event) => {
      handleProcessingUpdate(event.payload.job_id);
    }).then((unlisten) => {
      unlistenStarted = unlisten;
    });

    listen<ModelDownloadProgressPayload>('model-download-progress', (event) => {
      const { model_id, downloaded_bytes, total_bytes, speed_bps, eta_seconds } = event.payload;
      setDownloadProgress({
        modelId: model_id,
        downloaded: downloaded_bytes,
        total: total_bytes,
        speedBps: speed_bps,
        etaSeconds: eta_seconds,
      });
    }).then((unlisten) => {
      unlistenProgress = unlisten;
    });

    listen<ModelDownloadCompletePayload>('model-download-complete', () => {
      setDownloadProgress(null);
      setDownloadError(null);
      fetchModels();
    }).then((unlisten) => {
      unlistenComplete = unlisten;
    });

    listen<ModelDownloadErrorPayload>('model-download-error', (event) => {
      const { model_id, error } = event.payload;
      setDownloadProgress(null);
      setDownloadError({ modelId: model_id, message: error || 'Model download failed' });
      fetchModels();
    }).then((unlisten) => {
      unlistenError = unlisten;
    });

    return () => {
      cleanupTheme();
      if (unlistenAnalysis) unlistenAnalysis();
      if (unlistenFailed) unlistenFailed();
      if (unlistenQueued) unlistenQueued();
      if (unlistenStarted) unlistenStarted();
      if (unlistenProgress) unlistenProgress();
      if (unlistenComplete) unlistenComplete();
      if (unlistenError) unlistenError();
    };
  }, [handleAnalysisComplete, handleAnalysisFailed, handleProcessingUpdate, setDownloadProgress, setDownloadError, fetchModels]);

  if (onboardingCompleted === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black text-neutral-500 dark:text-neutral-400 text-xs">
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
