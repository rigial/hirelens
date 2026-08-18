import { ShieldCheck, Cpu, Zap, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { APP_NAME } from '../../lib/constants';

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const highlights = [
    {
      icon: ShieldCheck,
      title: 'Zero Cloud Uploads',
      desc: 'All resumes and applicant details remain strictly on your local computer.',
    },
    {
      icon: Cpu,
      title: 'On-Device AI Engine',
      desc: 'Powered by local LLMs that parse, evaluate, and extract candidate insights.',
    },
    {
      icon: Zap,
      title: 'Explainable Shortlisting',
      desc: 'Transparent scoring breakdowns showing skill matches, experience, and qualitative reviews.',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8 text-center py-6">
      <div className="space-y-3">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Welcome to {APP_NAME}
        </h1>
        <p className="text-base text-slate-600 max-w-lg mx-auto leading-relaxed">
          Your privacy-first, AI-powered desktop assistant for candidate screening and smart talent evaluation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
        {highlights.map((item, idx) => (
          <Card key={idx} className="border-slate-200/80 hover:border-indigo-200 transition-colors">
            <CardContent className="p-5 space-y-2.5">
              <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">{item.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="pt-4">
        <Button size="lg" onClick={onNext} className="gap-2 px-8">
          Get Started <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
