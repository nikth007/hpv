import { randomUUID } from 'node:crypto';
import type { Batch, Center, LabResult, Patient, Referral, Sample, SessionUser } from './types';
import { batchCode, patientCode, sampleBarcode } from './ids';
import { hashIdentifier, maskAbha, normalizeAadhaar, normalizeAbha } from './crypto';

export const demoCenters: Center[] = [
  { id: 'center-hub-iog', code: 'IOG-EGMORE', name: 'IOG Hospital, Egmore', centerType: 'hub', district: 'Chennai' },
  { id: 'center-stanley', code: 'STANLEY', name: 'Stanley', centerType: 'spoke', district: 'Chennai' },
  { id: 'center-kmc', code: 'KMC', name: 'KMC', centerType: 'spoke', district: 'Chennai' },
  { id: 'center-kgh', code: 'KGH-OMD', name: 'KGH / Omandurar Hospital', centerType: 'spoke', district: 'Chennai' },
  { id: 'center-phc', code: 'PHC-CHC', name: 'PHC / CHC centers', centerType: 'spoke', district: 'Chennai' }
];

export const demoUsers: Array<SessionUser & { passwordHash: string }> = [
  { id: 'user-admin', username: 'admin', fullName: 'Program Admin', role: 'admin', centerId: 'center-hub-iog', centerCode: 'IOG-EGMORE', centerName: 'IOG Hospital, Egmore', centerType: 'hub', passwordHash: 'demo:welcome@123' },
  { id: 'user-hub', username: 'hub', fullName: 'Hub Coordinator', role: 'hub', centerId: 'center-hub-iog', centerCode: 'IOG-EGMORE', centerName: 'IOG Hospital, Egmore', centerType: 'hub', passwordHash: 'demo:welcome@123' },
  { id: 'user-lab', username: 'lab', fullName: 'Lab User', role: 'lab', centerId: 'center-hub-iog', centerCode: 'IOG-EGMORE', centerName: 'IOG Hospital, Egmore', centerType: 'hub', passwordHash: 'demo:welcome@123' },
  { id: 'user-stanley', username: 'stanley', fullName: 'Stanley Spoke User', role: 'spoke', centerId: 'center-stanley', centerCode: 'STANLEY', centerName: 'Stanley', centerType: 'spoke', passwordHash: 'demo:welcome@123' },
  { id: 'user-kmc', username: 'kmc', fullName: 'KMC Spoke User', role: 'spoke', centerId: 'center-kmc', centerCode: 'KMC', centerName: 'KMC', centerType: 'spoke', passwordHash: 'demo:welcome@123' },
  { id: 'user-kgh', username: 'kgh', fullName: 'KGH Spoke User', role: 'spoke', centerId: 'center-kgh', centerCode: 'KGH-OMD', centerName: 'KGH / Omandurar Hospital', centerType: 'spoke', passwordHash: 'demo:welcome@123' },
  { id: 'user-phc', username: 'phc', fullName: 'PHC/CHC Spoke User', role: 'spoke', centerId: 'center-phc', centerCode: 'PHC-CHC', centerName: 'PHC / CHC centers', centerType: 'spoke', passwordHash: 'demo:welcome@123' }
];

type InternalPatient = Patient & {
  dob?: string;
  ageYears?: number;
  aadhaarHash?: string | null;
  abhaHash?: string | null;
};

type BatchSample = {
  batchId: string;
  sampleId: string;
  receiveStatus: 'PENDING' | 'RECEIVED' | 'MISSING' | 'DAMAGED';
};

const store = globalThis as typeof globalThis & {
  __hpvPatients?: InternalPatient[];
  __hpvSamples?: Sample[];
  __hpvBatches?: Batch[];
  __hpvBatchSamples?: BatchSample[];
  __hpvResults?: LabResult[];
  __hpvReferrals?: Referral[];
};

store.__hpvPatients ??= [];
store.__hpvSamples ??= [];
store.__hpvBatches ??= [];
store.__hpvBatchSamples ??= [];
store.__hpvResults ??= [];
store.__hpvReferrals ??= [];

export function getDemoUser(username: string) {
  return demoUsers.find((u) => u.username.toLowerCase() === username.toLowerCase());
}

export function getCenter(id?: string | null) {
  return demoCenters.find((c) => c.id === id);
}

export function listCenters() {
  return demoCenters;
}

function visiblePatients(user: SessionUser) {
  if (user.role !== 'spoke') return store.__hpvPatients!;
  return store.__hpvPatients!.filter((p) => p.centerId === user.centerId);
}

function visibleSamples(user: SessionUser) {
  if (user.role !== 'spoke') return store.__hpvSamples!;
  return store.__hpvSamples!.filter((s) => s.centerId === user.centerId);
}

function visibleBatches(user: SessionUser) {
  if (user.role !== 'spoke') return store.__hpvBatches!;
  return store.__hpvBatches!.filter((b) => b.sourceCenterId === user.centerId);
}

function isPositive(result: string) {
  return result === 'POSITIVE_HPV_16' || result === 'POSITIVE_HPV_18' || result === 'POSITIVE_OTHER_HR_HPV';
}

function patientPublic(p: InternalPatient): Patient {
  const { aadhaarHash, abhaHash, ...patient } = p;
  return patient;
}

export function dashboardFor(user: SessionUser) {
  const patients = visiblePatients(user);
  const samples = visibleSamples(user);
  const batches = visibleBatches(user);
  const referrals = user.role === 'spoke'
    ? store.__hpvReferrals!.filter((r) => patients.some((p) => p.id === r.patientId))
    : store.__hpvReferrals!;
  const results = user.role === 'spoke'
    ? store.__hpvResults!.filter((r) => samples.some((s) => s.id === r.sampleId))
    : store.__hpvResults!;

  return {
    totalPatients: patients.length,
    uniquePatients: patients.length,
    totalSamples: samples.length,
    collectedToday: samples.filter((s) => new Date(s.collectionDate).toDateString() === new Date().toDateString()).length,
    pendingDispatch: samples.filter((s) => s.status === 'COLLECTED').length,
    inTransit: samples.filter((s) => s.status === 'DISPATCHED').length,
    receivedAtHub: samples.filter((s) => s.status === 'RECEIVED_AT_HUB' || s.status === 'IN_PROCESS').length,
    pendingLabResult: samples.filter((s) => s.status === 'RECEIVED_AT_HUB' || s.status === 'IN_PROCESS').length,
    reported: samples.filter((s) => s.status === 'REPORTED' || s.status === 'REFERRED').length,
    positivePatients: results.filter((r) => isPositive(r.result)).length,
    referralPending: referrals.filter((r) => r.followUpStatus !== 'COMPLETED').length,
    samplesByCenter: demoCenters.map((center) => ({
      centerId: center.id,
      centerName: center.name,
      total: samples.filter((s) => s.centerId === center.id).length
    })),
    dailyTrend: lastNDays(7).map((day) => ({
      day,
      count: samples.filter((s) => s.collectionDate.slice(0, 10) === day).length
    })),
    centerPerformance: demoCenters.filter((c) => c.centerType === 'spoke').map((center) => ({
      centerId: center.id,
      centerName: center.name,
      collected: store.__hpvSamples!.filter((s) => s.centerId === center.id).length,
      dispatched: store.__hpvSamples!.filter((s) => s.centerId === center.id && s.status !== 'COLLECTED').length,
      reported: store.__hpvSamples!.filter((s) => s.centerId === center.id && (s.status === 'REPORTED' || s.status === 'REFERRED')).length
    })),
    recentSamples: samples.slice(-8).reverse(),
    batches: batches.slice(-8).reverse(),
    centers: demoCenters
  };
}

function lastNDays(days: number) {
  return Array.from({ length: days }).map((_, index) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - index));
    return d.toISOString().slice(0, 10);
  });
}

export function searchPatients(params: { q?: string; aadhaar?: string; abhaNumber?: string; mobile?: string; dob?: string }, user?: SessionUser) {
  const aadhaar = normalizeAadhaar(params.aadhaar);
  const abha = normalizeAbha(params.abhaNumber);
  const aadhaarHash = aadhaar ? hashIdentifier(aadhaar) : null;
  const abhaHash = abha ? hashIdentifier(abha) : null;
  const mobile = params.mobile?.replace(/\D/g, '');
  const q = params.q?.toLowerCase().trim();
  const scope = user && user.role === 'spoke' && !aadhaarHash && !abhaHash ? visiblePatients(user) : store.__hpvPatients!;
  return scope
    .filter((p) => {
      if (aadhaarHash && p.aadhaarHash === aadhaarHash) return true;
      if (abhaHash && p.abhaHash === abhaHash) return true;
      if (mobile && p.mobile?.replace(/\D/g, '') === mobile) return true;
      if (q && (p.fullName.toLowerCase().includes(q) || p.patientCode.toLowerCase().includes(q) || p.mobile?.includes(q))) return true;
      return false;
    })
    .map(patientPublic);
}

export function createPatient(input: any, user: SessionUser) {
  const aadhaar = normalizeAadhaar(input.aadhaar);
  const abha = normalizeAbha(input.abhaNumber);
  const aadhaarHash = aadhaar ? hashIdentifier(aadhaar) : null;
  const abhaHash = abha ? hashIdentifier(abha) : null;
  const duplicate = store.__hpvPatients!.find((p) => (aadhaarHash && p.aadhaarHash === aadhaarHash) || (abhaHash && p.abhaHash === abhaHash));
  if (duplicate) return { duplicate: patientPublic(duplicate) };

  const center = getCenter(user.centerId);
  const patient: InternalPatient = {
    id: randomUUID(),
    patientCode: patientCode(center?.code),
    fullName: input.fullName,
    dob: input.dob || undefined,
    ageYears: input.ageYears ? Number(input.ageYears) : undefined,
    gender: input.gender || 'female',
    mobile: input.mobile || undefined,
    aadhaarLast4: aadhaar ? aadhaar.slice(-4) : undefined,
    abhaNumber: abha ? maskAbha(abha) || undefined : undefined,
    aadhaarHash,
    abhaHash,
    centerId: user.centerId || undefined,
    centerName: center?.name,
    createdAt: new Date().toISOString()
  };
  store.__hpvPatients!.push(patient);
  return { patient: patientPublic(patient) };
}

export function createSample(input: any, user: SessionUser) {
  const patient = store.__hpvPatients!.find((p) => p.id === input.patientId);
  if (!patient) throw new Error('Patient not found');
  if (user.role === 'spoke' && patient.centerId !== user.centerId) throw new Error('Patient is outside your center.');
  const center = getCenter(user.centerId || patient.centerId);
  const sample: Sample = {
    id: randomUUID(),
    sampleId: sampleBarcode(center?.code),
    patientId: patient.id,
    patientName: patient.fullName,
    aadhaarLast4: patient.aadhaarLast4,
    centerId: center?.id || patient.centerId || 'unknown',
    centerName: center?.name,
    collectionMode: input.collectionMode || 'PROVIDER_COLLECTED',
    collectionDate: new Date().toISOString(),
    status: 'COLLECTED',
    conditionStatus: 'OK'
  };
  store.__hpvSamples!.push(sample);
  return sample;
}

export function listSamples(user: SessionUser, options: { id?: string; labPending?: boolean } = {}) {
  let samples = visibleSamples(user);
  if (options.id) samples = samples.filter((s) => s.id === options.id || s.sampleId === options.id);
  if (options.labPending) {
    samples = samples.filter(
      (s) => (s.status === 'RECEIVED_AT_HUB' || s.status === 'IN_PROCESS') && !store.__hpvResults!.some((r) => r.sampleId === s.id)
    );
  }
  return samples.slice().reverse();
}

export function createBatch(input: any, user: SessionUser) {
  const center = getCenter(user.centerId);
  const hub = demoCenters.find((c) => c.centerType === 'hub')!;
  const sampleIds = input.sampleIds as string[];
  const samples = store.__hpvSamples!.filter((s) => sampleIds.includes(s.id) && s.status === 'COLLECTED' && (user.role !== 'spoke' || s.centerId === user.centerId));
  if (!samples.length) throw new Error('No eligible collected samples selected');
  const batch: Batch = {
    id: randomUUID(),
    batchId: batchCode(center?.code),
    sourceCenterId: center?.id || samples[0].centerId,
    sourceCenterName: center?.name || samples[0].centerName,
    hubCenterId: hub.id,
    status: 'DISPATCHED',
    sampleCount: samples.length,
    courierName: input.courierName || undefined,
    dispatchedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  store.__hpvBatches!.push(batch);
  for (const s of samples) {
    s.status = 'DISPATCHED';
    store.__hpvBatchSamples!.push({ batchId: batch.id, sampleId: s.id, receiveStatus: 'PENDING' });
  }
  return batch;
}

export function listBatches(user: SessionUser, options: { receivePending?: boolean } = {}) {
  let batches = visibleBatches(user);
  if (options.receivePending) batches = batches.filter((batch) => batch.status === 'DISPATCHED');
  return batches.slice().reverse().map((batch) => ({
    ...batch,
    samples: store.__hpvBatchSamples!
      .filter((bs) => bs.batchId === batch.id)
      .map((bs) => ({ ...bs, sample: store.__hpvSamples!.find((s) => s.id === bs.sampleId) }))
  }));
}

export function receiveBatch(id: string, input: { missingSampleIds?: string[]; damagedSampleIds?: string[] } = {}) {
  const batch = store.__hpvBatches!.find((b) => b.id === id);
  if (!batch) throw new Error('Batch not found');
  if (batch.status !== 'DISPATCHED') throw new Error('This batch has already been received.');
  const missing = new Set(input.missingSampleIds || []);
  const damaged = new Set(input.damagedSampleIds || []);
  const links = store.__hpvBatchSamples!.filter((bs) => bs.batchId === id);

  for (const link of links) {
    const sample = store.__hpvSamples!.find((s) => s.id === link.sampleId);
    if (!sample) continue;
    if (missing.has(sample.id)) {
      link.receiveStatus = 'MISSING';
      sample.conditionStatus = 'MISSING';
      continue;
    }
    if (damaged.has(sample.id)) {
      link.receiveStatus = 'DAMAGED';
      sample.conditionStatus = 'DAMAGED';
      sample.status = 'RECEIVED_AT_HUB';
      continue;
    }
    link.receiveStatus = 'RECEIVED';
    sample.status = 'RECEIVED_AT_HUB';
    sample.conditionStatus = 'OK';
  }
  batch.status = links.some((l) => l.receiveStatus === 'MISSING' || l.receiveStatus === 'DAMAGED') ? 'PARTIALLY_RECEIVED' : 'RECEIVED';
  batch.receivedAt = new Date().toISOString();
  return batch;
}

export function createResult(input: any, user: SessionUser) {
  const sample = store.__hpvSamples!.find((s) => s.id === input.sampleId || s.sampleId === input.sampleId);
  if (!sample) throw new Error('Sample not found');
  if (!['RECEIVED_AT_HUB', 'IN_PROCESS', 'REPORTED', 'REFERRED'].includes(sample.status)) throw new Error('Sample has not been received at hub.');
  const patient = store.__hpvPatients!.find((p) => p.id === sample.patientId);
  sample.status = isPositive(input.result) ? 'REFERRED' : 'REPORTED';
  const result: LabResult = {
    id: randomUUID(),
    sampleId: sample.id,
    sampleCode: sample.sampleId,
    patientName: patient?.fullName || sample.patientName || 'Patient',
    result: input.result,
    remarks: input.remarks || undefined,
    reportedAt: new Date().toISOString()
  };
  const existingIndex = store.__hpvResults!.findIndex((r) => r.sampleId === sample.id);
  if (existingIndex >= 0) store.__hpvResults![existingIndex] = result;
  else store.__hpvResults!.push(result);

  if (isPositive(input.result) && patient && !store.__hpvReferrals!.some((r) => r.sampleId === sample.id)) {
    store.__hpvReferrals!.push({
      id: randomUUID(),
      patientId: patient.id,
      patientName: patient.fullName,
      sampleId: sample.id,
      sampleCode: sample.sampleId,
      result: input.result,
      referredToCenterId: user.centerId || undefined,
      referredToCenterName: user.centerName || 'IOG Hospital, Egmore',
      followUpStatus: 'PENDING_CONTACT',
      createdAt: new Date().toISOString()
    });
  }
  return result;
}

export function listResults(user?: SessionUser) {
  if (!user || user.role !== 'spoke') return store.__hpvResults!.slice().reverse();
  const sampleIds = new Set(visibleSamples(user).map((s) => s.id));
  return store.__hpvResults!.filter((r) => sampleIds.has(r.sampleId)).slice().reverse();
}

export function listReferrals(user?: SessionUser) {
  if (!user || user.role !== 'spoke') return store.__hpvReferrals!.slice().reverse();
  const patientIds = new Set(visiblePatients(user).map((p) => p.id));
  return store.__hpvReferrals!.filter((r) => patientIds.has(r.patientId)).slice().reverse();
}

export function updateReferral(id: string, input: any) {
  const referral = store.__hpvReferrals!.find((r) => r.id === id);
  if (!referral) throw new Error('Referral not found');
  referral.followUpStatus = input.followUpStatus || referral.followUpStatus;
  referral.followUpDate = input.followUpDate || referral.followUpDate;
  referral.notes = input.notes ?? referral.notes;
  referral.referredToCenterId = input.referredToCenterId || referral.referredToCenterId;
  referral.referredToCenterName = input.referredToCenterName || referral.referredToCenterName;
  return referral;
}
