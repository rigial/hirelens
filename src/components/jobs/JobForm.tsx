import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Briefcase } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Card, CardContent } from '../ui/Card';
import { SkillsInput } from './SkillsInput';
import { useJobStore } from '../../stores/useJobStore';
import { SkillPayload } from '../../types/job';

export function JobForm() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { activeJob, fetchJob, createJob, updateJob, isLoading } = useJobStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState<string>('full-time');
  const [experienceRequiredYears, setExperienceRequiredYears] = useState<string>('2');
  const [skills, setSkills] = useState<SkillPayload[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = Boolean(jobId);

  useEffect(() => {
    if (jobId) {
      fetchJob(jobId);
    }
  }, [jobId, fetchJob]);

  useEffect(() => {
    if (isEdit && activeJob) {
      setTitle(activeJob.title);
      setDescription(activeJob.description);
      setLocation(activeJob.location || '');
      setEmploymentType(activeJob.employmentType || 'full-time');
      setExperienceRequiredYears(
        activeJob.experienceRequiredYears !== null && activeJob.experienceRequiredYears !== undefined
          ? activeJob.experienceRequiredYears.toString()
          : '0'
      );
      setSkills(
        activeJob.skills.map((s) => ({
          skill: s.skill,
          importance: s.importance,
        }))
      );
    }
  }, [isEdit, activeJob]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Job title is required';
    if (title.length > 100) errs.title = 'Title must be 100 characters or less';
    if (!description.trim()) errs.description = 'Job description is required';
    if (description.trim().length < 20) errs.description = 'Description should be at least 20 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      title: title.trim(),
      description: description.trim(),
      location: location.trim() || null,
      employmentType: employmentType || null,
      experienceRequiredYears: experienceRequiredYears ? parseFloat(experienceRequiredYears) : 0,
      skills,
    };

    try {
      if (isEdit && jobId) {
        await updateJob(jobId, payload);
        navigate(`/jobs/${jobId}`);
      } else {
        const created = await createJob(payload);
        navigate(`/jobs/${created.id}`);
      }
    } catch {
      // Error handled in store
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(isEdit ? `/jobs/${jobId}` : '/jobs')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {isEdit ? 'Job Details' : 'Jobs'}
        </button>

        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-indigo-600" />
          {isEdit ? 'Edit Job Opening' : 'Create New Job Opening'}
        </h1>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Job Title"
              placeholder="e.g. Senior Frontend Engineer, Rust Systems Developer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title}
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Location"
                placeholder="e.g. Remote, Bangalore, New York"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Employment Type
                </label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                </select>
              </div>

              <Input
                label="Experience Required (Years)"
                type="number"
                min="0"
                step="0.5"
                placeholder="0 = Any"
                value={experienceRequiredYears}
                onChange={(e) => setExperienceRequiredYears(e.target.value)}
              />
            </div>

            <SkillsInput skills={skills} onChange={setSkills} />

            <Textarea
              label="Job Description"
              rows={6}
              placeholder="Paste the full job description and role requirements..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={errors.description}
              required
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(isEdit ? `/jobs/${jobId}` : '/jobs')}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="gap-2 px-6">
                <Save className="h-4 w-4" />
                {isEdit ? 'Update Job Opening' : 'Create Job Opening'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
