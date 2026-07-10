import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(2),
  password: z.string().min(6)
});

export const patientSchema = z.object({
  fullName: z.string().min(2, 'Patient name is required'),
  dob: z.string().optional().nullable(),
  ageYears: z.coerce.number().int().min(0).max(120).optional().nullable(),
  gender: z.string().default('female'),
  mobile: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  aadhaar: z.string().optional().nullable(),
  abhaNumber: z.string().optional().nullable(),
  consent: z.coerce.boolean().default(false)
}).refine((data) => Boolean(data.aadhaar || data.abhaNumber || (data.mobile && (data.dob || data.ageYears))), {
  message: 'Add Aadhaar, ABHA, or mobile with DOB/age for safe dedupe.',
  path: ['aadhaar']
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
