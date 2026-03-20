'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Sidebar } from '@/components/Sidebar';
import { User } from '@/lib/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface FormData {
  // Step 1 – Shop & Owner
  shop_name: string;
  owner_name: string;
  email: string;
  contact: string;
  address: string;
  municipality: string;
  ward_no: string;
  gps_lat: number | null;
  gps_lng: number | null;
  manual_lat: string;
  manual_lng: string;

  // Step 2 – Registration
  is_registered: boolean | null;
  cipc_number: string;
  has_coa: boolean | null;
  coa_number: string;
  has_health_cert: boolean | null;
  health_cert_number: string;
  owner_sa_citizen: boolean | null;
  owner_valid_id: boolean | null;
  owner_id_number: string;

  // Step 3 – Infrastructure
  structure_type: string;
  has_electricity: boolean | null;
  has_water: boolean | null;
  has_sanitation: boolean | null;
  trading_rooms: string;
  floor_area: string;

  // Step 4 – Hygiene
  shop_clean: boolean | null;
  food_off_floor: boolean | null;
  visible_pests: boolean | null;
  hand_wash_facility: boolean | null;
  protective_gear: boolean | null;

  // Step 5 – Food Safety
  food_within_expiry: boolean | null;
  correct_temp_storage: boolean | null;
  raw_cooked_separated: boolean | null;
  prohibited_goods: boolean | null;
  has_fridge: boolean | null;

  // Step 6 – Safety
  has_fire_extinguisher: boolean | null;
  fire_extinguisher_date: string;
  has_emergency_exits: boolean | null;
  safe_electrical_wiring: boolean | null;
  chemicals_stored_safely: boolean | null;

  // Step 7 – Business
  employs_staff: boolean | null;
  num_employees: string;
  num_sa_employees: string;
  monthly_turnover: string;
  has_bank_account: boolean | null;
  bank_name: string;
  account_type: string;
  accepts_card: boolean | null;
  sells_on_credit: boolean | null;

  // Step 8 – NEF Eligibility
  previously_disadvantaged: boolean | null;
  owner_is_woman: boolean | null;
  owner_is_youth: boolean | null;
  has_business_plan: boolean | null;
  received_govt_support: boolean | null;
  govt_support_program: string;
  interested_in_nef: boolean | null;

  // Step 9 – Photos
  photo_front: File | null;
  photo_interior: File | null;
  photo_id_doc: File | null;
  additional_notes: string;
}

const initialForm: FormData = {
  shop_name: '', owner_name: '', email: '', contact: '', address: '',
  municipality: '', ward_no: '', gps_lat: null, gps_lng: null,
  manual_lat: '', manual_lng: '',
  is_registered: null, cipc_number: '', has_coa: null, coa_number: '',
  has_health_cert: null, health_cert_number: '', owner_sa_citizen: null,
  owner_valid_id: null, owner_id_number: '',
  structure_type: '', has_electricity: null, has_water: null,
  has_sanitation: null, trading_rooms: '', floor_area: '',
  shop_clean: null, food_off_floor: null, visible_pests: null,
  hand_wash_facility: null, protective_gear: null,
  food_within_expiry: null, correct_temp_storage: null,
  raw_cooked_separated: null, prohibited_goods: null, has_fridge: null,
  has_fire_extinguisher: null, fire_extinguisher_date: '',
  has_emergency_exits: null, safe_electrical_wiring: null,
  chemicals_stored_safely: null,
  employs_staff: null, num_employees: '', num_sa_employees: '',
  monthly_turnover: '', has_bank_account: null, bank_name: '',
  account_type: '', accepts_card: null, sells_on_credit: null,
  previously_disadvantaged: null, owner_is_woman: null, owner_is_youth: null,
  has_business_plan: null, received_govt_support: null,
  govt_support_program: '', interested_in_nef: null,
  photo_front: null, photo_interior: null, photo_id_doc: null,
  additional_notes: '',
};

const STEP_LABELS = [
  'Shop & Owner',
  'Registration',
  'Infrastructure',
  'Hygiene',
  'Food Safety',
  'Safety',
  'Business',
  'NEF Eligibility',
  'Photos',
];

const TOTAL_STEPS = 9;

// ─────────────────────────────────────────────
// Score calculation
// ─────────────────────────────────────────────

function calculateScore(form: FormData): number {
  let score = 0;
  if (form.is_registered) score += 15;
  if (form.has_coa) score += 15;
  if (form.has_health_cert) score += 10;
  if (form.has_electricity) score += 5;
  if (form.has_water) score += 5;
  if (form.has_sanitation) score += 5;
  if (form.shop_clean) score += 5;
  if (form.food_off_floor) score += 5;
  if (form.food_within_expiry) score += 10;
  if (form.correct_temp_storage) score += 5;
  if (form.has_fire_extinguisher) score += 5;
  if (form.safe_electrical_wiring) score += 5;
  if (form.employs_staff) score += 5;
  if (form.has_bank_account) score += 5;
  if (form.interested_in_nef) score += 5;
  return Math.min(score, 100);
}

function getComplianceTier(score: number): { tier: number; label: string; color: string; description: string } {
  if (score >= 80) return { tier: 1, label: 'Gold', color: '#f59e0b', description: 'Highly compliant — NEF eligible' };
  if (score >= 60) return { tier: 2, label: 'Good', color: '#3b82f6', description: 'Meets basic requirements with some conditions' };
  if (score >= 40) return { tier: 3, label: 'Partial', color: '#f97316', description: 'Requires support and capacity building' };
  return { tier: 4, label: 'At Risk', color: '#ef4444', description: 'Requires significant support and intervention' };
}

// ─────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────

function YesNoToggle({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all border ${
          value === true
            ? 'bg-blue-600 border-blue-600 text-white shadow-md'
            : 'bg-transparent border-white/20 text-white/60 hover:border-white/40'
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all border ${
          value === false
            ? 'bg-teal-500 border-teal-500 text-white shadow-md'
            : 'bg-transparent border-white/20 text-white/60 hover:border-white/40'
        }`}
      >
        No
      </button>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-white/80 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-1">*</span>}
    </label>
  );
}

function TextInput({
  value, onChange, placeholder, type = 'text', className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 text-sm ${className}`}
    />
  );
}

function SelectInput({
  value, onChange, options, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2.5 bg-[#0D1B35] border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 text-sm appearance-none"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function TextareaInput({
  value, onChange, placeholder, rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 text-sm resize-none"
    />
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

// ─────────────────────────────────────────────
// Step Indicator
// ─────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 overflow-x-auto py-3 px-2 no-scrollbar">
      {STEP_LABELS.map((label, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        let circleClass = '';
        let textClass = 'text-white/30';
        let lineClass = 'bg-white/10';

        if (isCompleted) {
          circleClass = 'bg-teal-500 border-teal-500 text-white';
          textClass = 'text-teal-400';
          lineClass = 'bg-teal-500';
        } else if (isActive) {
          circleClass = 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/40';
          textClass = 'text-white font-semibold';
        } else {
          circleClass = 'bg-white/10 border-white/20 text-white/30';
        }

        return (
          <div key={stepNum} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1" style={{ minWidth: 44 }}>
              <div
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${circleClass}`}
              >
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span className={`text-[9px] leading-tight text-center max-w-[44px] transition-all ${textClass}`}>
                {label}
              </span>
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div className={`h-px w-5 mt-[-14px] transition-all ${lineClass}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Step forms
// ─────────────────────────────────────────────

function Step1({ form, setForm, gpsLoading, gpsError, onGetLocation }: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  gpsLoading: boolean;
  gpsError: string;
  onGetLocation: () => void;
}) {
  const f = (field: keyof FormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel required>Store Name</FieldLabel>
        <TextInput value={form.shop_name} onChange={f('shop_name')} placeholder="e.g. Mpho's Spaza Shop" />
      </div>
      <div>
        <FieldLabel required>Full Name (Owner)</FieldLabel>
        <TextInput value={form.owner_name} onChange={f('owner_name')} placeholder="Owner's full name" />
      </div>
      <div>
        <FieldLabel>Email Address</FieldLabel>
        <TextInput value={form.email} onChange={f('email')} type="email" placeholder="owner@email.com" />
      </div>
      <div>
        <FieldLabel>Contact Number</FieldLabel>
        <TextInput value={form.contact} onChange={f('contact')} type="tel" placeholder="07X XXX XXXX" />
      </div>
      <div>
        <FieldLabel>Physical Address</FieldLabel>
        <TextareaInput value={form.address} onChange={f('address')} placeholder="Street address, suburb, city" rows={2} />
      </div>
      <div>
        <FieldLabel required>Municipality</FieldLabel>
        <SelectInput
          value={form.municipality}
          onChange={f('municipality')}
          placeholder="Select municipality"
          options={[
            { label: 'KwaDukuza', value: 'KwaDukuza' },
            { label: 'Maphumulo', value: 'Maphumulo' },
            { label: 'Mandeni', value: 'Mandeni' },
            { label: 'Ndwedwe', value: 'Ndwedwe' },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Ward No.</FieldLabel>
        <TextInput value={form.ward_no} onChange={f('ward_no')} placeholder="e.g. 12" />
      </div>

      <SectionDivider label="GPS Coordinates" />

      {form.gps_lat !== null && form.gps_lng !== null ? (
        <div className="rounded-lg bg-teal-600/20 border border-teal-500/30 px-4 py-3 flex items-start gap-3">
          <svg className="text-teal-400 mt-0.5 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <div>
            <p className="text-teal-300 text-sm font-semibold">Location captured</p>
            <p className="text-white/60 text-xs mt-0.5">
              {form.gps_lat.toFixed(6)}, {form.gps_lng.toFixed(6)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, gps_lat: null, gps_lng: null }))}
            className="ml-auto text-white/30 hover:text-white/60 text-xs"
          >
            Clear
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onGetLocation}
          disabled={gpsLoading}
          className="w-full py-3 bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {gpsLoading ? 'Getting location...' : 'Get My Location'}
        </button>
      )}

      {gpsError && (
        <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {gpsError}
        </p>
      )}

      <div className="pt-1">
        <p className="text-white/40 text-xs mb-2">Or enter coordinates manually</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Latitude</FieldLabel>
            <TextInput
              value={form.manual_lat}
              onChange={(v) => {
                setForm((p) => ({ ...p, manual_lat: v, gps_lat: parseFloat(v) || null }));
              }}
              type="number"
              placeholder="-29.8587"
            />
          </div>
          <div>
            <FieldLabel>Longitude</FieldLabel>
            <TextInput
              value={form.manual_lng}
              onChange={(v) => {
                setForm((p) => ({ ...p, manual_lng: v, gps_lng: parseFloat(v) || null }));
              }}
              type="number"
              placeholder="31.0218"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Step2({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const yn = (field: keyof FormData) => (v: boolean) =>
    setForm((p) => ({ ...p, [field]: v }));
  const f = (field: keyof FormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <FieldLabel>Is the shop registered?</FieldLabel>
        <YesNoToggle value={form.is_registered} onChange={yn('is_registered')} />
        {form.is_registered === true && (
          <div className="pt-1 pl-1">
            <FieldLabel>CIPC Number</FieldLabel>
            <TextInput value={form.cipc_number} onChange={f('cipc_number')} placeholder="e.g. 2024/123456/07" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <FieldLabel>Does the shop have a Certificate of Acceptability (CoA)?</FieldLabel>
        <YesNoToggle value={form.has_coa} onChange={yn('has_coa')} />
        {form.has_coa === true && (
          <div className="pt-1 pl-1">
            <FieldLabel>CoA Number</FieldLabel>
            <TextInput value={form.coa_number} onChange={f('coa_number')} placeholder="CoA certificate number" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <FieldLabel>Does the shop have a health certificate?</FieldLabel>
        <YesNoToggle value={form.has_health_cert} onChange={yn('has_health_cert')} />
        {form.has_health_cert === true && (
          <div className="pt-1 pl-1">
            <FieldLabel>Certificate Number</FieldLabel>
            <TextInput value={form.health_cert_number} onChange={f('health_cert_number')} placeholder="Health certificate number" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <FieldLabel>Is the owner a South African citizen?</FieldLabel>
        <YesNoToggle value={form.owner_sa_citizen} onChange={yn('owner_sa_citizen')} />
      </div>

      <div className="space-y-2">
        <FieldLabel>Does the owner have a valid SA ID?</FieldLabel>
        <YesNoToggle value={form.owner_valid_id} onChange={yn('owner_valid_id')} />
        {form.owner_valid_id === true && (
          <div className="pt-1 pl-1">
            <FieldLabel>ID Number</FieldLabel>
            <TextInput value={form.owner_id_number} onChange={f('owner_id_number')} placeholder="13-digit SA ID number" />
          </div>
        )}
      </div>
    </div>
  );
}

function Step3({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const yn = (field: keyof FormData) => (v: boolean) =>
    setForm((p) => ({ ...p, [field]: v }));
  const f = (field: keyof FormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <FieldLabel>Type of structure</FieldLabel>
        <SelectInput
          value={form.structure_type}
          onChange={f('structure_type')}
          placeholder="Select structure type"
          options={[
            { label: 'Formal building', value: 'formal_building' },
            { label: 'Container', value: 'container' },
            { label: 'Informal structure', value: 'informal_structure' },
            { label: 'Other', value: 'other' },
          ]}
        />
      </div>

      <div className="space-y-2">
        <FieldLabel>Does the shop have electricity?</FieldLabel>
        <YesNoToggle value={form.has_electricity} onChange={yn('has_electricity')} />
      </div>

      <div className="space-y-2">
        <FieldLabel>Does the shop have running water?</FieldLabel>
        <YesNoToggle value={form.has_water} onChange={yn('has_water')} />
      </div>

      <div className="space-y-2">
        <FieldLabel>Does the shop have toilet/sanitation?</FieldLabel>
        <YesNoToggle value={form.has_sanitation} onChange={yn('has_sanitation')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Rooms used for trading</FieldLabel>
          <TextInput value={form.trading_rooms} onChange={f('trading_rooms')} type="number" placeholder="e.g. 2" />
        </div>
        <div>
          <FieldLabel>Floor area (m²)</FieldLabel>
          <TextInput value={form.floor_area} onChange={f('floor_area')} type="number" placeholder="e.g. 30" />
        </div>
      </div>
    </div>
  );
}

function Step4({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const yn = (field: keyof FormData) => (v: boolean) =>
    setForm((p) => ({ ...p, [field]: v }));

  return (
    <div className="space-y-5">
      {(
        [
          { field: 'shop_clean', label: 'Is the shop clean and tidy?' },
          { field: 'food_off_floor', label: 'Is food stored off the floor?' },
          { field: 'visible_pests', label: 'Are there visible pests or rodents?' },
          { field: 'hand_wash_facility', label: 'Is there a hand washing facility?' },
          { field: 'protective_gear', label: 'Are food handlers wearing protective gear?' },
        ] as { field: keyof FormData; label: string }[]
      ).map(({ field, label }) => (
        <div key={field} className="space-y-2">
          <FieldLabel>{label}</FieldLabel>
          <YesNoToggle value={form[field] as boolean | null} onChange={yn(field)} />
        </div>
      ))}
    </div>
  );
}

function Step5({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const yn = (field: keyof FormData) => (v: boolean) =>
    setForm((p) => ({ ...p, [field]: v }));

  return (
    <div className="space-y-5">
      {(
        [
          { field: 'food_within_expiry', label: 'Are food products within expiry date?' },
          { field: 'correct_temp_storage', label: 'Is food stored at correct temperatures?' },
          { field: 'raw_cooked_separated', label: 'Are raw and cooked foods separated?' },
          { field: 'prohibited_goods', label: 'Is the shop selling prohibited/counterfeit goods?' },
          { field: 'has_fridge', label: 'Does the shop have a temperature-controlled fridge?' },
        ] as { field: keyof FormData; label: string }[]
      ).map(({ field, label }) => (
        <div key={field} className="space-y-2">
          <FieldLabel>{label}</FieldLabel>
          <YesNoToggle value={form[field] as boolean | null} onChange={yn(field)} />
        </div>
      ))}
    </div>
  );
}

function Step6({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const yn = (field: keyof FormData) => (v: boolean) =>
    setForm((p) => ({ ...p, [field]: v }));
  const f = (field: keyof FormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <FieldLabel>Is there a fire extinguisher?</FieldLabel>
        <YesNoToggle value={form.has_fire_extinguisher} onChange={yn('has_fire_extinguisher')} />
        {form.has_fire_extinguisher === true && (
          <div className="pt-1 pl-1">
            <FieldLabel>Last service date</FieldLabel>
            <TextInput value={form.fire_extinguisher_date} onChange={f('fire_extinguisher_date')} type="date" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <FieldLabel>Are there emergency exits?</FieldLabel>
        <YesNoToggle value={form.has_emergency_exits} onChange={yn('has_emergency_exits')} />
      </div>

      <div className="space-y-2">
        <FieldLabel>Is electrical wiring safe?</FieldLabel>
        <YesNoToggle value={form.safe_electrical_wiring} onChange={yn('safe_electrical_wiring')} />
      </div>

      <div className="space-y-2">
        <FieldLabel>Are dangerous chemicals stored safely?</FieldLabel>
        <YesNoToggle value={form.chemicals_stored_safely} onChange={yn('chemicals_stored_safely')} />
      </div>
    </div>
  );
}

function Step7({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const yn = (field: keyof FormData) => (v: boolean) =>
    setForm((p) => ({ ...p, [field]: v }));
  const f = (field: keyof FormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <FieldLabel>Does the shop employ staff?</FieldLabel>
        <YesNoToggle value={form.employs_staff} onChange={yn('employs_staff')} />
        {form.employs_staff === true && (
          <div className="grid grid-cols-2 gap-3 pt-1 pl-1">
            <div>
              <FieldLabel>Total employees</FieldLabel>
              <TextInput value={form.num_employees} onChange={f('num_employees')} type="number" placeholder="0" />
            </div>
            <div>
              <FieldLabel>SA citizens employed</FieldLabel>
              <TextInput value={form.num_sa_employees} onChange={f('num_sa_employees')} type="number" placeholder="0" />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <FieldLabel>Estimated monthly turnover</FieldLabel>
        <SelectInput
          value={form.monthly_turnover}
          onChange={f('monthly_turnover')}
          placeholder="Select range"
          options={[
            { label: 'Less than R5,000', value: '<R5k' },
            { label: 'R5,000 – R20,000', value: 'R5k-R20k' },
            { label: 'R20,000 – R50,000', value: 'R20k-R50k' },
            { label: 'R50,000 – R100,000', value: 'R50k-R100k' },
            { label: 'More than R100,000', value: '>R100k' },
          ]}
        />
      </div>

      <div className="space-y-2">
        <FieldLabel>Does the shop have a business bank account?</FieldLabel>
        <YesNoToggle value={form.has_bank_account} onChange={yn('has_bank_account')} />
        {form.has_bank_account === true && (
          <div className="space-y-3 pt-1 pl-1">
            <div>
              <FieldLabel>Bank name</FieldLabel>
              <TextInput value={form.bank_name} onChange={f('bank_name')} placeholder="e.g. Capitec, FNB, ABSA" />
            </div>
            <div>
              <FieldLabel>Account type</FieldLabel>
              <SelectInput
                value={form.account_type}
                onChange={f('account_type')}
                placeholder="Select account type"
                options={[
                  { label: 'Cheque', value: 'cheque' },
                  { label: 'Savings', value: 'savings' },
                  { label: 'Business', value: 'business' },
                ]}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <FieldLabel>Does the shop accept card payments?</FieldLabel>
        <YesNoToggle value={form.accepts_card} onChange={yn('accepts_card')} />
      </div>

      <div className="space-y-2">
        <FieldLabel>Does the shop sell on credit?</FieldLabel>
        <YesNoToggle value={form.sells_on_credit} onChange={yn('sells_on_credit')} />
      </div>
    </div>
  );
}

function Step8({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const yn = (field: keyof FormData) => (v: boolean) =>
    setForm((p) => ({ ...p, [field]: v }));
  const f = (field: keyof FormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <FieldLabel>Is the owner previously disadvantaged?</FieldLabel>
        <YesNoToggle value={form.previously_disadvantaged} onChange={yn('previously_disadvantaged')} />
      </div>

      <div className="space-y-2">
        <FieldLabel>Is the owner a woman?</FieldLabel>
        <YesNoToggle value={form.owner_is_woman} onChange={yn('owner_is_woman')} />
      </div>

      <div className="space-y-2">
        <FieldLabel>Is the owner a youth (under 35)?</FieldLabel>
        <YesNoToggle value={form.owner_is_youth} onChange={yn('owner_is_youth')} />
      </div>

      <div className="space-y-2">
        <FieldLabel>Does the business have a business plan?</FieldLabel>
        <YesNoToggle value={form.has_business_plan} onChange={yn('has_business_plan')} />
      </div>

      <div className="space-y-2">
        <FieldLabel>Has the owner received any government support?</FieldLabel>
        <YesNoToggle value={form.received_govt_support} onChange={yn('received_govt_support')} />
        {form.received_govt_support === true && (
          <div className="pt-1 pl-1">
            <FieldLabel>Program name</FieldLabel>
            <TextInput value={form.govt_support_program} onChange={f('govt_support_program')} placeholder="e.g. SEDA, DTI, NYDA" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <FieldLabel>Is the owner interested in NEF funding?</FieldLabel>
        <YesNoToggle value={form.interested_in_nef} onChange={yn('interested_in_nef')} />
      </div>
    </div>
  );
}

function Step9({
  form,
  setForm,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  const score = calculateScore(form);
  const tier = getComplianceTier(score);

  function handleFile(field: 'photo_front' | 'photo_interior' | 'photo_id_doc', file: File | null) {
    setForm((p) => ({ ...p, [field]: file }));
  }

  const photoFields: { field: 'photo_front' | 'photo_interior' | 'photo_id_doc'; label: string; hint: string }[] = [
    { field: 'photo_front', label: 'Shop front photo', hint: 'Clear photo of the shop exterior' },
    { field: 'photo_interior', label: 'Shop interior photo', hint: 'Inside of the shop' },
    { field: 'photo_id_doc', label: 'Owner ID / document photo', hint: 'ID book, ID card or business doc' },
  ];

  const summaryRows: { label: string; value: string }[] = [
    { label: 'Shop name', value: form.shop_name || '—' },
    { label: 'Owner', value: form.owner_name || '—' },
    { label: 'Municipality', value: form.municipality || '—' },
    { label: 'GPS', value: form.gps_lat !== null ? `${form.gps_lat.toFixed(4)}, ${form.gps_lng?.toFixed(4)}` : '—' },
    { label: 'Registered', value: form.is_registered === null ? '—' : form.is_registered ? 'Yes' : 'No' },
    { label: 'Has CoA', value: form.has_coa === null ? '—' : form.has_coa ? 'Yes' : 'No' },
    { label: 'Electricity', value: form.has_electricity === null ? '—' : form.has_electricity ? 'Yes' : 'No' },
    { label: 'Water', value: form.has_water === null ? '—' : form.has_water ? 'Yes' : 'No' },
    { label: 'Employs staff', value: form.employs_staff === null ? '—' : form.employs_staff ? `Yes (${form.num_employees || '?'})` : 'No' },
    { label: 'Bank account', value: form.has_bank_account === null ? '—' : form.has_bank_account ? 'Yes' : 'No' },
    { label: 'NEF interest', value: form.interested_in_nef === null ? '—' : form.interested_in_nef ? 'Yes' : 'No' },
  ];

  return (
    <div className="space-y-5">
      {photoFields.map(({ field, label, hint }) => (
        <div key={field}>
          <FieldLabel>{label}</FieldLabel>
          <label className="block cursor-pointer">
            <div
              className={`w-full rounded-lg border-2 border-dashed px-4 py-4 text-center transition-all ${
                form[field] ? 'border-teal-500/50 bg-teal-500/10' : 'border-white/20 hover:border-white/40'
              }`}
            >
              {form[field] ? (
                <div>
                  <p className="text-teal-300 text-sm font-medium">{(form[field] as File).name}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {((form[field] as File).size / 1024).toFixed(0)} KB — click to replace
                  </p>
                </div>
              ) : (
                <div>
                  <svg className="mx-auto mb-1 text-white/30" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <p className="text-white/50 text-sm">Tap to upload photo</p>
                  <p className="text-white/30 text-xs">{hint}</p>
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(field, e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      ))}

      <div>
        <FieldLabel>Additional notes</FieldLabel>
        <TextareaInput
          value={form.additional_notes}
          onChange={(v) => setForm((p) => ({ ...p, additional_notes: v }))}
          placeholder="Any additional observations or comments..."
          rows={3}
        />
      </div>

      <SectionDivider label="Assessment Preview" />

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ backgroundColor: `${tier.color}22`, borderBottom: `1px solid ${tier.color}33` }}
        >
          <div>
            <p className="text-white font-semibold text-sm">Compliance Score</p>
            <p className="text-white/50 text-xs">{tier.description}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: tier.color }}>{score}</p>
            <p className="text-xs font-semibold" style={{ color: tier.color }}>{tier.label}</p>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {summaryRows.map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center px-4 py-2">
              <span className="text-white/50 text-xs">{label}</span>
              <span className="text-white text-xs font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Success screen
// ─────────────────────────────────────────────

function SuccessScreen({
  score,
  tier,
  onBack,
}: {
  score: number;
  tier: { tier: number; label: string; color: string; description: string };
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 gap-6">
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold shadow-2xl"
        style={{ backgroundColor: `${tier.color}22`, border: `3px solid ${tier.color}`, color: tier.color }}
      >
        {score}
      </div>
      <div>
        <h2 className="text-white text-2xl font-bold mb-1">Assessment Submitted!</h2>
        <p className="text-white/50 text-sm">The assessment has been saved successfully.</p>
      </div>
      <div
        className="rounded-xl px-6 py-4 w-full max-w-xs"
        style={{ backgroundColor: `${tier.color}15`, border: `1px solid ${tier.color}30` }}
      >
        <p className="font-bold text-lg mb-0.5" style={{ color: tier.color }}>{tier.label}</p>
        <p className="text-white/60 text-sm">{tier.description}</p>
      </div>
      <button
        onClick={onBack}
        className="w-full max-w-xs py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all text-sm"
      >
        Back to Shops
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────

function validateStep(step: number, form: FormData): string | null {
  if (step === 1) {
    if (!form.shop_name.trim()) return 'Store name is required.';
    if (!form.owner_name.trim()) return 'Owner full name is required.';
    if (!form.municipality) return 'Please select a municipality.';
  }
  return null;
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function AssessmentWizardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [agentId, setAgentId] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  // Auth
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }
      setAgentId(session.user.id);

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userData) setUser(userData as User);
    })();
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/');
  }, [supabase, router]);

  // GPS
  function handleGetLocation() {
    setGpsLoading(true);
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported on this device.');
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((p) => ({
          ...p,
          gps_lat: pos.coords.latitude,
          gps_lng: pos.coords.longitude,
          manual_lat: pos.coords.latitude.toString(),
          manual_lng: pos.coords.longitude.toString(),
        }));
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Please enable in your browser settings.'
            : 'Could not get location. Try manual entry.'
        );
        setGpsLoading(false);
      },
      { timeout: 10000 }
    );
  }

  // Navigation
  function goNext() {
    const error = validateStep(currentStep, form);
    if (error) { setValidationError(error); return; }
    setValidationError('');
    if (currentStep < TOTAL_STEPS) setCurrentStep((s) => s + 1);
  }

  function goPrev() {
    setValidationError('');
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }

  // Submit
  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const score = calculateScore(form);
      const tier = getComplianceTier(score);

      const payload = {
        agent_id: agentId,
        shop_name: form.shop_name,
        owner_name: form.owner_name,
        email: form.email || null,
        contact: form.contact || null,
        address: form.address || null,
        municipality: form.municipality || null,
        ward_no: form.ward_no || null,
        gps_lat: form.gps_lat,
        gps_lng: form.gps_lng,

        is_registered: form.is_registered,
        cipc_number: form.cipc_number || null,
        has_coa: form.has_coa,
        coa_number: form.coa_number || null,
        has_health_cert: form.has_health_cert,
        health_cert_number: form.health_cert_number || null,
        owner_sa_citizen: form.owner_sa_citizen,
        owner_valid_id: form.owner_valid_id,
        owner_id_number: form.owner_id_number || null,

        structure_type: form.structure_type || null,
        has_electricity: form.has_electricity,
        has_water: form.has_water,
        has_sanitation: form.has_sanitation,
        trading_rooms: form.trading_rooms ? parseInt(form.trading_rooms) : null,
        floor_area: form.floor_area ? parseFloat(form.floor_area) : null,

        shop_clean: form.shop_clean,
        food_off_floor: form.food_off_floor,
        visible_pests: form.visible_pests,
        hand_wash_facility: form.hand_wash_facility,
        protective_gear: form.protective_gear,

        food_within_expiry: form.food_within_expiry,
        correct_temp_storage: form.correct_temp_storage,
        raw_cooked_separated: form.raw_cooked_separated,
        prohibited_goods: form.prohibited_goods,
        has_fridge: form.has_fridge,

        has_fire_extinguisher: form.has_fire_extinguisher,
        fire_extinguisher_date: form.fire_extinguisher_date || null,
        has_emergency_exits: form.has_emergency_exits,
        safe_electrical_wiring: form.safe_electrical_wiring,
        chemicals_stored_safely: form.chemicals_stored_safely,

        employs_staff: form.employs_staff,
        num_employees: form.num_employees ? parseInt(form.num_employees) : null,
        num_sa_employees: form.num_sa_employees ? parseInt(form.num_sa_employees) : null,
        monthly_turnover: form.monthly_turnover || null,
        has_bank_account: form.has_bank_account,
        bank_name: form.bank_name || null,
        account_type: form.account_type || null,
        accepts_card: form.accepts_card,
        sells_on_credit: form.sells_on_credit,

        previously_disadvantaged: form.previously_disadvantaged,
        owner_is_woman: form.owner_is_woman,
        owner_is_youth: form.owner_is_youth,
        has_business_plan: form.has_business_plan,
        received_govt_support: form.received_govt_support,
        govt_support_program: form.govt_support_program || null,
        interested_in_nef: form.interested_in_nef,

        additional_notes: form.additional_notes || null,

        compliance_score: score,
        compliance_tier: tier.tier,
        status: 'submitted',
        created_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      };

      await supabase.from('assessments').insert([payload]);

      setFinalScore(score);
      setSubmitted(true);
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const progress = (currentStep / TOTAL_STEPS) * 100;
  const tier = getComplianceTier(finalScore);

  // ── Render ──

  if (submitted) {
    return (
      <div className="flex min-h-screen bg-gray-100">
        <Sidebar activePage="shops" user={user} onLogout={handleLogout} />
        <main className="flex-1 md:ml-64 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-[#0D1B35] rounded-2xl p-6 shadow-2xl">
            <SuccessScreen score={finalScore} tier={tier} onBack={() => router.push('/submissions')} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar activePage="shops" user={user} onLogout={handleLogout} />

      <main className="flex-1 md:ml-64 p-4 md:p-8 flex flex-col gap-6">
        {/* Form card */}
        <div className="w-full max-w-2xl mx-auto bg-[#0D1B35] rounded-2xl shadow-2xl overflow-hidden">

          {/* Card header */}
          <div className="px-6 pt-6 pb-0">
            <h1 className="text-white text-xl font-bold leading-tight">Spaza Shop Assessment</h1>
            <p className="text-white/40 text-sm mt-0.5">Step {currentStep} of {TOTAL_STEPS}</p>

            {/* Progress bar */}
            <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Step indicator */}
            <StepIndicator currentStep={currentStep} />
          </div>

          {/* Step title bar */}
          <div className="px-6 py-3 border-t border-white/5 border-b border-white/5">
            <h2 className="text-white font-semibold text-base">
              {STEP_LABELS[currentStep - 1]}
            </h2>
          </div>

          {/* Step content */}
          <div className="px-6 py-5">
            {currentStep === 1 && (
              <Step1 form={form} setForm={setForm} gpsLoading={gpsLoading} gpsError={gpsError} onGetLocation={handleGetLocation} />
            )}
            {currentStep === 2 && <Step2 form={form} setForm={setForm} />}
            {currentStep === 3 && <Step3 form={form} setForm={setForm} />}
            {currentStep === 4 && <Step4 form={form} setForm={setForm} />}
            {currentStep === 5 && <Step5 form={form} setForm={setForm} />}
            {currentStep === 6 && <Step6 form={form} setForm={setForm} />}
            {currentStep === 7 && <Step7 form={form} setForm={setForm} />}
            {currentStep === 8 && <Step8 form={form} setForm={setForm} />}
            {currentStep === 9 && <Step9 form={form} setForm={setForm} />}

            {/* Validation error */}
            {validationError && (
              <div className="mt-4 px-4 py-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-300 text-sm">
                {validationError}
              </div>
            )}
          </div>

          {/* Navigation footer */}
          <div className="px-6 pb-6 flex gap-3">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={goPrev}
                className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl transition-all text-sm"
              >
                Previous
              </button>
            )}

            {currentStep < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={goNext}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all text-sm shadow-lg shadow-blue-600/30"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold rounded-xl transition-all text-sm shadow-lg shadow-teal-600/30"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
