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
  has_bank_account_s2: boolean | null;
  bank_name_s2: string;
  has_coa: boolean | null;
  coa_number: string;

  // Step 3 – Infrastructure
  years_operating: string;
  structure_type: string;
  store_size: string;
  storage: string[];
  products: string[];

  // Step 4 – General Hygiene
  cleanliness_ok: boolean | null;
  no_dust: boolean | null;
  handwashing: boolean | null;
  no_animals: boolean | null;
  waste_ok: boolean | null;
  hygiene_other: string;

  // Step 5 – Food Safety
  food_on_floor: boolean | null;
  expired_food: boolean | null;
  food_labelled: boolean | null;
  food_nonfood_separated: boolean | null;
  food_safety_other: string;

  // Step 6 – General & Safety Requirements
  lighting_ok: boolean | null;
  floors_ok: boolean | null;
  cleaning_materials: boolean | null;
  safety_signage: boolean | null;
  disability_accessible: boolean | null;
  not_sleeping_space: boolean | null;
  yms_observations: string;

  // Step 7 – Business Development
  payment_methods: string[];
  has_pos: boolean | null;
  ordering_methods: string[];
  makes_deliveries: boolean | null;
  click_collect: boolean | null;
  collection_point: string[];
  space_security: boolean | null;
  monthly_turnover: string;
  num_employees: string;
  support_needed: string[];

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
  is_registered: null, cipc_number: '',
  has_bank_account_s2: null, bank_name_s2: '',
  has_coa: null, coa_number: '',
  years_operating: '', structure_type: '', store_size: '', storage: [], products: [],
  cleanliness_ok: null, no_dust: null, handwashing: null, no_animals: null,
  waste_ok: null, hygiene_other: '',
  food_on_floor: null, expired_food: null, food_labelled: null,
  food_nonfood_separated: null, food_safety_other: '',
  lighting_ok: null, floors_ok: null, cleaning_materials: null,
  safety_signage: null, disability_accessible: null, not_sleeping_space: null,
  yms_observations: '',
  payment_methods: [], has_pos: null, ordering_methods: [], makes_deliveries: null,
  click_collect: null, collection_point: [], space_security: null,
  monthly_turnover: '', num_employees: '', support_needed: [],
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
  if (form.has_bank_account_s2) score += 10;
  if (form.cleanliness_ok) score += 5;
  if (form.waste_ok) score += 5;
  if (!form.food_on_floor) score += 5;
  if (!form.expired_food) score += 5;
  if (form.food_labelled) score += 5;
  if (form.lighting_ok) score += 5;
  if (form.floors_ok) score += 5;
  if (form.safety_signage) score += 5;
  if (form.payment_methods.length > 0) score += 5;
  if (form.interested_in_nef) score += 5;
  if (form.storage.length > 0) score += 5;
  if (form.products.length > 2) score += 5;
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

// Dropdown that shows Yes / No — styled to match the dark card
function YesNoDropdown({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="relative">
      <select
        value={value === null ? '' : value ? 'yes' : 'no'}
        onChange={(e) => onChange(e.target.value === 'yes')}
        className="w-full px-4 py-3.5 bg-[#1a2744] border border-white/10 rounded-xl text-white text-sm appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
      >
        <option value="" disabled>Select...</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}

// Row layout: label left, control right — used in Step 2
function RegistrationRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 py-5 border-b border-white/5 last:border-0">
      <div className="w-[38%] text-white font-semibold text-sm leading-snug pt-3">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// Single-select tile (type of structure, shop size)
function TileButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-4 py-3.5 rounded-xl border text-sm font-medium text-left transition-all ${
        selected
          ? 'border-blue-500 bg-blue-600/20 text-white'
          : 'border-white/10 bg-white/5 text-white/50 hover:border-white/25 hover:text-white/75'
      }`}
    >
      {label}
    </button>
  );
}

// Multi-select tile (storage, products)
function MultiTile({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-4 py-3.5 rounded-xl border text-sm font-medium text-left transition-all ${
        selected
          ? 'border-teal-500 bg-teal-600/20 text-white'
          : 'border-white/10 bg-white/5 text-white/50 hover:border-white/25 hover:text-white/75'
      }`}
    >
      {label}
    </button>
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
  const f = (field: keyof FormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  return (
    <div>
      <RegistrationRow label="Registered with CIPC?">
        <YesNoDropdown
          value={form.is_registered}
          onChange={(v) => setForm((p) => ({ ...p, is_registered: v }))}
        />
        {form.is_registered === true && (
          <div className="mt-3">
            <TextInput
              value={form.cipc_number}
              onChange={f('cipc_number')}
              placeholder="CIPC Registration Number"
            />
          </div>
        )}
      </RegistrationRow>

      <RegistrationRow label="Business bank account?">
        <YesNoDropdown
          value={form.has_bank_account_s2}
          onChange={(v) => setForm((p) => ({ ...p, has_bank_account_s2: v }))}
        />
        {form.has_bank_account_s2 === true && (
          <div className="mt-3">
            <TextInput
              value={form.bank_name_s2}
              onChange={f('bank_name_s2')}
              placeholder="Bank name"
            />
          </div>
        )}
      </RegistrationRow>

      <RegistrationRow label="Municipal CoA for Food Handling?">
        <YesNoDropdown
          value={form.has_coa}
          onChange={(v) => setForm((p) => ({ ...p, has_coa: v }))}
        />
        {form.has_coa === true && (
          <div className="mt-3">
            <TextInput
              value={form.coa_number}
              onChange={f('coa_number')}
              placeholder="CoA Certificate Number"
            />
          </div>
        )}
      </RegistrationRow>
    </div>
  );
}

const STRUCTURE_TYPES = ['Container', 'Temporary Structure', 'Stand-alone', 'Residential Property', 'Other'];
const SHOP_SIZES = ['Small', 'Medium', 'Large'];
const STORAGE_OPTIONS = ['Fridge', 'Freezer', 'Shelves', 'Other'];
const PRODUCT_OPTIONS = [
  'Groceries', 'Beverages', 'Snacks', 'Bread',
  'Dairy', 'Fresh Produce', 'Cooked Food', 'Airtime', 'Other',
];

function Step3({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const f = (field: keyof FormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  function toggleMulti(field: 'storage' | 'products', value: string) {
    setForm((p) => {
      const current = p[field] as string[];
      return {
        ...p,
        [field]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  }

  return (
    <div className="space-y-6">
      {/* Years operating */}
      <div>
        <FieldLabel>Years operating</FieldLabel>
        <TextInput
          value={form.years_operating}
          onChange={f('years_operating')}
          placeholder="e.g. 3 years"
        />
      </div>

      {/* Type of structure */}
      <div>
        <FieldLabel>Type of structure</FieldLabel>
        <div className="grid grid-cols-2 gap-2.5 mt-1">
          {STRUCTURE_TYPES.map((s) => (
            <TileButton
              key={s}
              label={s}
              selected={form.structure_type === s}
              onClick={() => setForm((p) => ({ ...p, structure_type: s }))}
            />
          ))}
        </div>
      </div>

      {/* Shop size */}
      <div>
        <FieldLabel>Shop size</FieldLabel>
        <div className="grid grid-cols-3 gap-2.5 mt-1">
          {SHOP_SIZES.map((s) => (
            <TileButton
              key={s}
              label={s}
              selected={form.store_size === s}
              onClick={() => setForm((p) => ({ ...p, store_size: s }))}
            />
          ))}
        </div>
      </div>

      {/* Storage */}
      <div>
        <FieldLabel>Storage <span className="text-white/40 font-normal">(Select all that apply)</span></FieldLabel>
        <div className="grid grid-cols-2 gap-2.5 mt-1">
          {STORAGE_OPTIONS.map((s) => (
            <MultiTile
              key={s}
              label={s}
              selected={form.storage.includes(s)}
              onClick={() => toggleMulti('storage', s)}
            />
          ))}
        </div>
      </div>

      {/* Products */}
      <div>
        <FieldLabel>Products <span className="text-white/40 font-normal">(Select all that apply)</span></FieldLabel>
        <div className="grid grid-cols-2 gap-2.5 mt-1">
          {PRODUCT_OPTIONS.map((s) => (
            <MultiTile
              key={s}
              label={s}
              selected={form.products.includes(s)}
              onClick={() => toggleMulti('products', s)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Step4({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const f = (field: keyof FormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  const rows: { field: keyof FormData; label: string }[] = [
    { field: 'cleanliness_ok', label: 'Acceptable Overall Cleanliness' },
    { field: 'no_dust', label: 'No Excessive Dust and/or Dirt on Surfaces' },
    { field: 'handwashing', label: 'Hand-washing' },
    { field: 'no_animals', label: 'Animals/Pets on Premises' },
    { field: 'waste_ok', label: 'Acceptable Waste Usage' },
  ];

  return (
    <div>
      {rows.map(({ field, label }) => (
        <RegistrationRow key={field} label={label}>
          <YesNoDropdown
            value={form[field] as boolean | null}
            onChange={(v) => setForm((p) => ({ ...p, [field]: v }))}
          />
        </RegistrationRow>
      ))}

      {/* Other (Specify) */}
      <div className="pt-5">
        <FieldLabel>Other (Specify)</FieldLabel>
        <TextInput
          value={form.hygiene_other}
          onChange={f('hygiene_other')}
          placeholder=""
        />
      </div>
    </div>
  );
}

function Step5({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const f = (field: keyof FormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  const rows: { field: keyof FormData; label: string }[] = [
    { field: 'food_on_floor', label: 'Food Stored Directly on Floor' },
    { field: 'expired_food', label: 'Expired, Damaged, Dented Food Containers on Shelves' },
    { field: 'food_labelled', label: 'Food Items Labelled within Expiry Date' },
    { field: 'food_nonfood_separated', label: 'Food & non-food items stored separately' },
  ];

  return (
    <div>
      {rows.map(({ field, label }) => (
        <RegistrationRow key={field} label={label}>
          <YesNoDropdown
            value={form[field] as boolean | null}
            onChange={(v) => setForm((p) => ({ ...p, [field]: v }))}
          />
        </RegistrationRow>
      ))}

      {/* Other (Specify) */}
      <div className="pt-5">
        <FieldLabel>Other (Specify)</FieldLabel>
        <TextInput
          value={form.food_safety_other}
          onChange={f('food_safety_other')}
          placeholder=""
        />
      </div>
    </div>
  );
}

function Step6({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const f = (field: keyof FormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  const rows: { field: keyof FormData; label: string }[] = [
    { field: 'lighting_ok', label: 'Acceptable Lighting & Ventilation' },
    { field: 'floors_ok', label: 'Acceptable Floors, Walls & Ceiling' },
    { field: 'cleaning_materials', label: 'Cleaning Materials on Site' },
    { field: 'safety_signage', label: 'Safety Signage & Hazards' },
    { field: 'disability_accessible', label: 'Disability Accessible' },
    { field: 'not_sleeping_space', label: 'Shop not used for sleeping or living purposes' },
  ];

  return (
    <div>
      {rows.map(({ field, label }) => (
        <RegistrationRow key={field} label={label}>
          <YesNoDropdown
            value={form[field] as boolean | null}
            onChange={(v) => setForm((p) => ({ ...p, [field]: v }))}
          />
        </RegistrationRow>
      ))}

      {/* YMS Observations */}
      <div className="pt-5">
        <FieldLabel>YMS Observations</FieldLabel>
        <TextareaInput
          value={form.yms_observations}
          onChange={f('yms_observations')}
          placeholder="Field agent observations..."
          rows={4}
        />
      </div>
    </div>
  );
}

// ── Cyan section header used in Step 7 ───────────────────
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-bold text-cyan-400 mt-6 mb-3">{children}</p>
  );
}

const PAYMENT_OPTIONS = ['CASH', 'CARD', 'EFT', 'MOBILE'];
const ORDER_OPTIONS = ['Cash & Carry', 'Local', 'Informal', 'Group buying'];
const COLLECTION_OPTIONS = ['Medication', 'Govt parcels', 'E-commerce', 'No'];
const TURNOVER_OPTIONS = ['<R5k', 'R5k–R10k', '>R10k'];
const SUPPORT_OPTIONS = ['Registration', 'Banking', 'Food Safety', 'Equipment', 'POS'];

function Step7({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const f = (field: keyof FormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  function toggleMulti(field: 'payment_methods' | 'ordering_methods' | 'collection_point' | 'support_needed', value: string) {
    setForm((p) => {
      const current = p[field] as string[];
      return {
        ...p,
        [field]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  }

  return (
    <div>
      {/* ── Section A ── */}
      <SectionHeader>Section A: Digital &amp; Payment Systems</SectionHeader>

      <div className="mb-5">
        <FieldLabel>Payments</FieldLabel>
        <div className="grid grid-cols-2 gap-2.5 mt-1">
          {PAYMENT_OPTIONS.map((o) => (
            <MultiTile
              key={o}
              label={o}
              selected={form.payment_methods.includes(o)}
              onClick={() => toggleMulti('payment_methods', o)}
            />
          ))}
        </div>
      </div>

      <RegistrationRow label="Point Of Sale (POS) system?">
        <YesNoDropdown
          value={form.has_pos}
          onChange={(v) => setForm((p) => ({ ...p, has_pos: v }))}
        />
      </RegistrationRow>

      {/* ── Section B ── */}
      <SectionHeader>Section B: Ordering, Delivery &amp; Collection</SectionHeader>

      <div className="mb-5">
        <FieldLabel>Where do you order?</FieldLabel>
        <div className="grid grid-cols-2 gap-2.5 mt-1">
          {ORDER_OPTIONS.map((o) => (
            <MultiTile
              key={o}
              label={o}
              selected={form.ordering_methods.includes(o)}
              onClick={() => toggleMulti('ordering_methods', o)}
            />
          ))}
        </div>
      </div>

      <RegistrationRow label="Do you make deliveries?">
        <YesNoDropdown
          value={form.makes_deliveries}
          onChange={(v) => setForm((p) => ({ ...p, makes_deliveries: v }))}
        />
      </RegistrationRow>

      <RegistrationRow label="Can customers order and collect?">
        <YesNoDropdown
          value={form.click_collect}
          onChange={(v) => setForm((p) => ({ ...p, click_collect: v }))}
        />
      </RegistrationRow>

      {/* ── Section C ── */}
      <SectionHeader>Section C: Community Service Potential</SectionHeader>

      <div className="mb-5">
        <FieldLabel>Collection point for:</FieldLabel>
        <div className="grid grid-cols-2 gap-2.5 mt-1">
          {COLLECTION_OPTIONS.map((o) => (
            <MultiTile
              key={o}
              label={o}
              selected={form.collection_point.includes(o)}
              onClick={() => toggleMulti('collection_point', o)}
            />
          ))}
        </div>
      </div>

      <RegistrationRow label="Space & security adequate?">
        <YesNoDropdown
          value={form.space_security}
          onChange={(v) => setForm((p) => ({ ...p, space_security: v }))}
        />
      </RegistrationRow>

      {/* ── Section D ── */}
      <SectionHeader>Section D: Business Activity &amp; Support Needs</SectionHeader>

      <div className="mb-5">
        <FieldLabel>Monthly turnover</FieldLabel>
        <div className="grid grid-cols-3 gap-2.5 mt-1">
          {TURNOVER_OPTIONS.map((o) => (
            <TileButton
              key={o}
              label={o}
              selected={form.monthly_turnover === o}
              onClick={() => setForm((p) => ({ ...p, monthly_turnover: o }))}
            />
          ))}
        </div>
      </div>

      <div className="mb-5">
        <FieldLabel>No. of Employees</FieldLabel>
        <TextInput value={form.num_employees} onChange={f('num_employees')} type="number" placeholder="" />
      </div>

      <div>
        <FieldLabel>Support needed</FieldLabel>
        <div className="grid grid-cols-2 gap-2.5 mt-1">
          {SUPPORT_OPTIONS.map((o) => (
            <MultiTile
              key={o}
              label={o}
              selected={form.support_needed.includes(o)}
              onClick={() => toggleMulti('support_needed', o)}
            />
          ))}
        </div>
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
    { label: 'Bank account', value: form.has_bank_account_s2 === null ? '—' : form.has_bank_account_s2 ? 'Yes' : 'No' },
    { label: 'Structure', value: form.structure_type || '—' },
    { label: 'Shop size', value: form.store_size || '—' },
    { label: 'Employees', value: form.num_employees || '—' },
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
        has_bank_account: form.has_bank_account_s2,
        bank_name: form.bank_name_s2 || null,
        has_coa: form.has_coa,
        coa_number: form.coa_number || null,

        years_operating: form.years_operating || null,
        structure_type: form.structure_type || null,
        store_size: form.store_size || null,
        storage: form.storage.length > 0 ? form.storage : null,
        products: form.products.length > 0 ? form.products : null,

        cleanliness_ok: form.cleanliness_ok,
        no_dust: form.no_dust,
        handwashing: form.handwashing,
        no_animals: form.no_animals,
        waste_ok: form.waste_ok,
        hygiene_other: form.hygiene_other || null,

        food_on_floor: form.food_on_floor,
        expired_food: form.expired_food,
        food_labelled: form.food_labelled,
        food_nonfood_separated: form.food_nonfood_separated,
        food_safety_other: form.food_safety_other || null,

        lighting_ok: form.lighting_ok,
        floors_ok: form.floors_ok,
        cleaning_materials: form.cleaning_materials,
        safety_signage: form.safety_signage,
        disability_accessible: form.disability_accessible,
        not_sleeping_space: form.not_sleeping_space,
        yms_observations: form.yms_observations || null,

        payment_methods: form.payment_methods,
        has_pos: form.has_pos,
        ordering_methods: form.ordering_methods,
        makes_deliveries: form.makes_deliveries,
        click_collect: form.click_collect,
        collection_point: form.collection_point,
        space_security: form.space_security,
        monthly_turnover: form.monthly_turnover || null,
        num_employees: form.num_employees ? parseInt(form.num_employees) : null,
        support_needed: form.support_needed,

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
