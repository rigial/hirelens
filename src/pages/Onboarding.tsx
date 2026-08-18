import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WelcomeStep } from '../components/onboarding/WelcomeStep';
import { ModelDownloadStep } from '../components/onboarding/ModelDownloadStep';

export function Onboarding() {
  const [step, setStep] = useState<1 | 2>(1);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white border border-slate-200/80 rounded-2xl shadow-xl p-8">
        {step === 1 ? (
          <WelcomeStep onNext={() => setStep(2)} />
        ) : (
          <ModelDownloadStep onComplete={() => navigate('/')} />
        )}
      </div>
    </div>
  );
}
