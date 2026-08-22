import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WelcomeStep } from '../components/onboarding/WelcomeStep';
import { ModelDownloadStep } from '../components/onboarding/ModelDownloadStep';

export function Onboarding() {
  const [step, setStep] = useState<1 | 2>(1);
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen overflow-hidden bg-neutral-100 dark:bg-black text-neutral-900 dark:text-neutral-100 flex items-center justify-center p-6 transition-colors select-none">
      <div className="w-full max-w-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-8 max-h-[90vh] overflow-y-auto overscroll-contain">
        {step === 1 ? (
          <WelcomeStep onNext={() => setStep(2)} />
        ) : (
          <ModelDownloadStep onComplete={() => navigate('/')} />
        )}
      </div>
    </div>
  );
}
