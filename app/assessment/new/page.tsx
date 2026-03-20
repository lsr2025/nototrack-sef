'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Assessment, User } from '@/lib/types';
import { WIZARD_STEPS } from '@/lib/wizard-steps';
import { calculateScore } from '@/lib/compliance';
import { saveAssessment, saveToQueue } from '@/lib/offline-db';

export default function AssessmentWizardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [user, setUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const [answers, setAnswers] = useState<Assessment>({
    agent_id: '',
    shop_name: '',
    owner_name: '',
    contact: '',
    address: '',
    is_registered: false,
    has_cipc: false,
    tax_compliant: false,
    has_bank_account: false,
    employs_staff: false,
    staff_count: undefined,
    stock_value: '',
    status: 'draft',
  });

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  useEffect(() => {
    loadUser();
    setIsOnline(navigator.onLine);
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
  }, []);

  async function loadUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push('/');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (userData) {
      setUser(userData as User);
      setAnswers((prev) => ({
        ...prev,
        agent_id: session.user.id,
      }));
    }
  }

  const step = WIZARD_STEPS.find((s) => s.id === currentStep);

  function nextStep() {
    if (currentStep < WIZARD_STEPS.length) {
      setDirection('forward');
      setCurrentStep(currentStep + 1);
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      setDirection('back');
      setCurrentStep(currentStep - 1);
    }
  }

  function handleTextInput(value: string, field: keyof Assessment) {
    setAnswers((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleYesNo(value: boolean, field: keyof Assessment) {
    setAnswers((prev) => ({
      ...prev,
      [field]: value,
    }));
    nextStep();
  }

  function handleSelect(value: string) {
    setAnswers((prev) => ({
      ...prev,
      stock_value: value,
    }));
    nextStep();
  }

  async function captureGPS() {
    setGpsLoading(true);
    setGpsError('');

    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported on this device');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAnswers((prev) => ({
          ...prev,
          gps_lat: position.coords.latitude,
          gps_lng: position.coords.longitude,
        }));
        setGpsLoading(false);
        nextStep();
      },
      (error) => {
        let message = 'Failed to capture location';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location permission denied. Please enable in settings.';
        }
        setGpsError(message);
        setGpsLoading(false);
      }
    );
  }

  async function submitAssessment() {
    setIsSubmitting(true);

    try {
      const score = calculateScore(answers);
      const assessmentData: Assessment = {
        ...answers,
        compliance_score: score,
        status: isOnline ? 'submitted' : 'pending_sync',
        created_at: new Date().toISOString(),
      };

      if (isOnline) {
        // Try to submit to Supabase
        const { error } = await supabase
          .from('assessments')
          .insert([
            {
              agent_id: answers.agent_id,
              shop_name: answers.shop_name,
              owner_name: answers.owner_name,
              contact: answers.contact,
              gps_lat: answers.gps_lat,
              gps_lng: answers.gps_lng,
              address: answers.address,
              is_registered: answers.is_registered,
              has_cipc: answers.has_cipc,
              tax_compliant: answers.tax_compliant,
              has_bank_account: answers.has_bank_account,
              employs_staff: answers.employs_staff,
              staff_count: answers.staff_count,
              stock_value: answers.stock_value,
              compliance_score: score,
              status: 'submitted',
              created_at: new Date().toISOString(),
              synced_at: new Date().toISOString(),
            },
          ]);

        if (error) {
          // Save to queue if online submit fails
          assessmentData.status = 'pending_sync';
          const offline = await saveAssessment(assessmentData);
          await saveToQueue({
            id: `queue_${Date.now()}`,
            type: 'assessment',
            data: offline,
            created_at: Date.now(),
            status: 'pending',
          });
        } else {
          // Save locally as synced
          await saveAssessment(assessmentData);
        }
      } else {
        // Save to local db and queue
        const offline = await saveAssessment(assessmentData);
        await saveToQueue({
          id: `queue_${Date.now()}`,
          type: 'assessment',
          data: offline,
          created_at: Date.now(),
          status: 'pending',
        });
      }

      setIsSubmitting(false);
      router.push('/submissions?success=true');
    } catch (error) {
      console.error('Error submitting:', error);
      setIsSubmitting(false);
    }
  }

  async function saveAndExit() {
    try {
      await saveAssessment(answers);
      router.push('/dashboard');
    } catch (error) {
      console.error('Error saving:', error);
    }
  }

  if (!step) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const animationClass =
    direction === 'forward'
      ? 'slide-in-right'
      : 'slide-in-left';

  return (
    <main className="min-h-screen bg-dark pt-4 pb-24">
      <OfflineBanner />

      {/* Header with progress */}
      <div className="px-4 py-4 border-b border-teal/20 sticky top-0 bg-dark/95 z-40">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="px-3 py-2 text-teal hover:bg-teal/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Back
          </button>
          <span className="text-sm font-medium text-white/70">
            Step {currentStep} of {WIZARD_STEPS.length}
          </span>
          {!isOnline && <span className="text-xs text-yellow-500">⚠ Offline</span>}
        </div>
        {/* Progress bar */}
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal transition-all duration-300"
            style={{
              width: `${(currentStep / WIZARD_STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className={`px-4 py-8 min-h-[60vh] ${animationClass}`}>
        <h2 className="text-xl font-bold text-white mb-6">{step.question}</h2>

        {/* Text/Tel input */}
        {(step.type === 'text' || step.type === 'tel') && (
          <div className="space-y-4">
            <input
              type={step.type === 'tel' ? 'tel' : 'text'}
              value={
                step.id === 1
                  ? answers.shop_name
                  : step.id === 2
                  ? answers.owner_name
                  : step.id === 3
                  ? answers.contact
                  : step.id === 5
                  ? answers.address
                  : ''
              }
              onChange={(e) => {
                if (step.id === 1) handleTextInput(e.target.value, 'shop_name');
                if (step.id === 2) handleTextInput(e.target.value, 'owner_name');
                if (step.id === 3) handleTextInput(e.target.value, 'contact');
                if (step.id === 5) handleTextInput(e.target.value, 'address');
              }}
              placeholder={step.type === 'tel' ? '07XX XXX XXXX' : 'Enter answer...'}
              className="w-full px-4 py-3 bg-navy border border-teal/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/30"
              autoFocus
            />
            <button
              onClick={nextStep}
              className="w-full py-3 bg-teal text-dark font-bold rounded-lg hover:bg-teal/90 transition"
            >
              Next
            </button>
          </div>
        )}

        {/* GPS Capture */}
        {step.type === 'gps' && (
          <div className="space-y-4">
            {answers.gps_lat && answers.gps_lng ? (
              <div className="bg-navy rounded-lg p-4 border border-green-600/30">
                <p className="text-green-300 font-semibold">✓ Location Captured</p>
                <p className="text-white/70 text-sm mt-2">
                  Latitude: {answers.gps_lat.toFixed(6)}
                </p>
                <p className="text-white/70 text-sm">
                  Longitude: {answers.gps_lng.toFixed(6)}
                </p>
              </div>
            ) : (
              <button
                onClick={captureGPS}
                disabled={gpsLoading}
                className="w-full py-4 bg-teal text-dark font-bold rounded-lg hover:bg-teal/90 transition disabled:opacity-50"
              >
                {gpsLoading ? 'Capturing...' : '📍 Capture Location'}
              </button>
            )}
            {gpsError && (
              <div className="p-3 bg-red-600/20 border border-red-600/50 rounded-lg text-red-200 text-sm">
                {gpsError}
              </div>
            )}
            <button
              onClick={nextStep}
              disabled={!answers.gps_lat || !answers.gps_lng}
              className="w-full py-3 bg-white/20 text-white font-bold rounded-lg hover:bg-white/30 transition disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

        {/* Yes/No buttons */}
        {step.type === 'yesno' && (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                if (step.id === 6) handleYesNo(true, 'is_registered');
                if (step.id === 7) handleYesNo(true, 'has_cipc');
                if (step.id === 8) handleYesNo(true, 'tax_compliant');
                if (step.id === 9) handleYesNo(true, 'has_bank_account');
                if (step.id === 10) {
                  setAnswers((prev) => ({
                    ...prev,
                    employs_staff: true,
                  }));
                  nextStep();
                }
              }}
              className="py-4 bg-teal text-dark font-bold rounded-lg hover:bg-teal/90 transition text-lg"
            >
              Yes ✓
            </button>
            <button
              onClick={() => {
                if (step.id === 6) handleYesNo(false, 'is_registered');
                if (step.id === 7) handleYesNo(false, 'has_cipc');
                if (step.id === 8) handleYesNo(false, 'tax_compliant');
                if (step.id === 9) handleYesNo(false, 'has_bank_account');
                if (step.id === 10) {
                  setAnswers((prev) => ({
                    ...prev,
                    employs_staff: false,
                  }));
                  nextStep();
                }
              }}
              className="py-4 bg-red-600/70 text-white font-bold rounded-lg hover:bg-red-600 transition text-lg"
            >
              No ✗
            </button>
          </div>
        )}

        {/* Staff count follow-up */}
        {step.id === 10 && answers.employs_staff && (
          <div className="space-y-4 mt-6">
            <div className="bg-navy/50 rounded-lg p-4 border border-teal/20">
              <label className="block text-sm font-medium text-white/80 mb-2">
                How many staff members?
              </label>
              <input
                type="number"
                min="1"
                value={answers.staff_count || ''}
                onChange={(e) =>
                  setAnswers((prev) => ({
                    ...prev,
                    staff_count: parseInt(e.target.value) || undefined,
                  }))
                }
                className="w-full px-4 py-3 bg-dark/50 border border-teal/30 rounded-lg text-white"
                placeholder="Enter number"
              />
            </div>
            <button
              onClick={nextStep}
              disabled={!answers.staff_count}
              className="w-full py-3 bg-teal text-dark font-bold rounded-lg hover:bg-teal/90 transition disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

        {/* Select options */}
        {step.type === 'select' && (
          <div className="space-y-3">
            {step.options?.map((option) => (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                className={`w-full p-4 rounded-lg font-medium transition border-2 ${
                  answers.stock_value === option
                    ? 'bg-teal border-teal text-dark'
                    : 'bg-navy border-teal/30 text-white hover:border-teal'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {/* Review step */}
        {step.type === 'review' && (
          <div className="space-y-4">
            <div className="bg-navy rounded-lg p-4 space-y-3 border border-teal/20">
              <ReviewRow label="Shop Name" value={answers.shop_name} />
              <ReviewRow label="Owner Name" value={answers.owner_name || '-'} />
              <ReviewRow label="Contact" value={answers.contact || '-'} />
              <ReviewRow
                label="GPS"
                value={
                  answers.gps_lat && answers.gps_lng
                    ? `${answers.gps_lat.toFixed(4)}, ${answers.gps_lng.toFixed(4)}`
                    : '-'
                }
              />
              <ReviewRow label="Address" value={answers.address || '-'} />
              <ReviewRow label="Formally Registered" value={answers.is_registered ? 'Yes' : 'No'} />
              <ReviewRow label="CIPC Registration" value={answers.has_cipc ? 'Yes' : 'No'} />
              <ReviewRow label="Tax Compliant" value={answers.tax_compliant ? 'Yes' : 'No'} />
              <ReviewRow
                label="Business Bank Account"
                value={answers.has_bank_account ? 'Yes' : 'No'}
              />
              <ReviewRow
                label="Employs Staff"
                value={
                  answers.employs_staff ? `Yes (${answers.staff_count || 0} staff)` : 'No'
                }
              />
              <ReviewRow label="Stock Value" value={answers.stock_value || '-'} />
            </div>

            <button
              onClick={submitAssessment}
              disabled={isSubmitting}
              className="w-full py-4 bg-teal text-dark font-bold rounded-lg hover:bg-teal/90 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : '✓ Submit Assessment'}
            </button>

            <button
              onClick={saveAndExit}
              className="w-full py-3 bg-white/10 text-white font-bold rounded-lg hover:bg-white/20 transition"
            >
              💾 Save & Exit
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start border-b border-white/10 pb-2 last:border-0">
      <span className="text-white/70 text-sm">{label}</span>
      <span className="text-white font-semibold text-right">{value}</span>
    </div>
  );
}
