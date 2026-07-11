import { z } from 'zod';

const optionalText = z.preprocess(
  (value) => (value === null || value === undefined || value === '' ? undefined : String(value).trim()),
  z.string().optional()
);

const requiredText = (message: string) => z.preprocess(
  (value) => (value === null || value === undefined ? '' : String(value).trim()),
  z.string().min(1, message)
);

const optionalAge = z.preprocess(
  (value) => (value === null || value === undefined || value === '' ? undefined : value),
  z.coerce.number().int().min(0).max(120).optional()
);

export const loginSchema = z.object({
  username: z.string().min(2),
  password: z.string().min(6)
});

export const patientSchema = z.object({
  fullName: requiredText('Patient name is required').pipe(z.string().min(2, 'Patient name is required')),
  dob: optionalText,
  ageYears: optionalAge,
  gender: z.string().default('female'),
  mobile: z.preprocess(
    (value) => String(value ?? '').replace(/\D/g, ''),
    z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits')
  ),
  address: optionalText,
  aadhaar: optionalText,
  abhaNumber: optionalText,
  consent: z.coerce.boolean().default(false)
}).superRefine((data, ctx) => {
  const aadhaarDigits = data.aadhaar?.replace(/\D/g, '') || '';
  const abhaDigits = data.abhaNumber?.replace(/\D/g, '') || '';

  if (!data.dob && data.ageYears === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'Date of birth or age is required',
      path: ['dob']
    });
  }

  if (!aadhaarDigits && !abhaDigits) {
    ctx.addIssue({
      code: 'custom',
      message: 'Aadhaar or ABHA is required',
      path: ['aadhaar']
    });
  }

  if (aadhaarDigits && aadhaarDigits.length !== 12) {
    ctx.addIssue({
      code: 'custom',
      message: 'Aadhaar number must be 12 digits',
      path: ['aadhaar']
    });
  }

  if (abhaDigits && abhaDigits.length !== 14) {
    ctx.addIssue({
      code: 'custom',
      message: 'ABHA number must be 14 digits',
      path: ['abhaNumber']
    });
  }
});

export const sampleSchema = z.object({
  patientId: z.string().min(1),
  collectionMode: z.enum(['PROVIDER_COLLECTED', 'SELF_SAMPLED']).default('PROVIDER_COLLECTED')
});

export const batchSchema = z.object({
  sampleIds: z.array(z.string()).min(1),
  courierName: z.string().optional().nullable()
});

export const resultSchema = z.object({
  sampleId: z.string().min(1),
  result: z.enum(['NEGATIVE', 'POSITIVE_HPV_16', 'POSITIVE_HPV_18', 'POSITIVE_OTHER_HR_HPV', 'INVALID_REPEAT_REQUIRED']),
  remarks: z.string().optional().nullable()
});

export const receiveBatchSchema = z.object({
  missingSampleIds: z.array(z.string()).default([]),
  damagedSampleIds: z.array(z.string()).default([])
});

export const referralUpdateSchema = z.object({
  id: z.string().min(1),
  followUpStatus: z.enum(['PENDING_CONTACT', 'CONTACTED', 'APPOINTMENT_GIVEN', 'VISITED', 'LOST_TO_FOLLOWUP', 'COMPLETED']).optional(),
  followUpDate: z.string().optional().nullable(),
  referredToCenterId: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});
