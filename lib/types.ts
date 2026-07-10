export type Role = 'admin' | 'hub' | 'lab' | 'spoke';
export type CenterType = 'hub' | 'spoke';
export type SampleStatus =
  | 'COLLECTED'
  | 'DISPATCHED'
  | 'RECEIVED_AT_HUB'
  | 'IN_PROCESS'
  | 'REPORTED'
  | 'REFERRED';

export type BatchStatus = 'DISPATCHED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED';
export type ResultValue =
  | 'NEGATIVE'
  | 'POSITIVE_HPV_16'
  | 'POSITIVE_HPV_18'
  | 'POSITIVE_OTHER_HR_HPV'
  | 'INVALID_REPEAT_REQUIRED';
export type FollowUpStatus =
  | 'PENDING_CONTACT'
  | 'CONTACTED'
  | 'APPOINTMENT_GIVEN'
  | 'VISITED'
  | 'LOST_TO_FOLLOWUP'
  | 'COMPLETED';

export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  centerId: string | null;
  centerCode?: string;
  centerName?: string;
  centerType?: CenterType;
};

export type Center = {
  id: string;
  code: string;
  name: string;
  centerType: CenterType;
  district?: string;
};

export type Patient = {
  id: string;
  patientCode: string;
  fullName: string;
  dob?: string;
  ageYears?: number;
  gender: string;
  mobile?: string;
  aadhaarLast4?: string;
  abhaNumber?: string;
  centerId?: string;
  centerName?: string;
  createdAt: string;
};

export type Sample = {
  id: string;
  sampleId: string;
  patientId: string;
  patientName?: string;
  aadhaarLast4?: string;
  centerId: string;
  centerName?: string;
  collectionMode: 'PROVIDER_COLLECTED' | 'SELF_SAMPLED';
  collectionDate: string;
  status: SampleStatus;
  conditionStatus?: 'OK' | 'MISSING' | 'DAMAGED';
};

export type Batch = {
  id: string;
  batchId: string;
  sourceCenterId: string;
  sourceCenterName?: string;
  hubCenterId: string;
  status: BatchStatus;
  sampleCount: number;
  courierName?: string;
  dispatchedAt?: string;
  receivedAt?: string;
  createdAt: string;
};

export type LabResult = {
  id: string;
  sampleId: string;
  sampleCode: string;
  patientName: string;
  result: ResultValue;
  remarks?: string;
  reportedAt: string;
};

export type Referral = {
  id: string;
  patientId: string;
  patientName?: string;
  sampleId?: string;
  sampleCode?: string;
  result: ResultValue;
  referredToCenterId?: string;
  referredToCenterName?: string;
  followUpStatus: FollowUpStatus;
  followUpDate?: string;
  notes?: string;
  createdAt: string;
};
