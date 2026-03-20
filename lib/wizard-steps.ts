import { WizardStep } from './types';

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    question: 'What is the name of the spaza shop?',
    type: 'text',
    required: true,
  },
  {
    id: 2,
    question: "What is the shop owner's full name?",
    type: 'text',
    required: false,
  },
  {
    id: 3,
    question: "What is the owner's contact number?",
    type: 'tel',
    required: false,
  },
  {
    id: 4,
    question: "Capture the shop's GPS coordinates",
    type: 'gps',
    required: false,
  },
  {
    id: 5,
    question: "What is the shop's street address?",
    type: 'text',
    required: false,
  },
  {
    id: 6,
    question: 'Is this shop formally registered as a business?',
    type: 'yesno',
    required: true,
  },
  {
    id: 7,
    question: 'Does the shop have a CIPC registration number?',
    type: 'yesno',
    required: true,
  },
  {
    id: 8,
    question: 'Is the owner tax compliant (has tax clearance certificate)?',
    type: 'yesno',
    required: true,
  },
  {
    id: 9,
    question: 'Does the shop owner have a business bank account?',
    type: 'yesno',
    required: true,
  },
  {
    id: 10,
    question: 'Does this shop employ any staff other than the owner?',
    type: 'yesno',
    required: true,
    showFollowUp: true,
  },
  {
    id: 11,
    question: 'What is the estimated value of current stock?',
    type: 'select',
    options: ['Under R5,000', 'R5,000 - R20,000', 'R20,001 - R50,000', 'Over R50,000'],
    required: true,
  },
  {
    id: 12,
    question: 'Review and Submit',
    type: 'review',
    required: true,
  },
];

export function getStep(stepNumber: number): WizardStep | undefined {
  return WIZARD_STEPS.find((step) => step.id === stepNumber);
}

export function getTotalSteps(): number {
  return WIZARD_STEPS.length;
}
