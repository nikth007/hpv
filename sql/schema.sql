CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  center_type TEXT NOT NULL CHECK (center_type IN ('hub','spoke')),
  district TEXT,
  address TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','hub','lab','spoke')),
  center_id UUID REFERENCES centers(id),
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_center_id ON users(center_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  dob DATE,
  age_years INTEGER,
  gender TEXT NOT NULL DEFAULT 'female',
  mobile TEXT,
  address TEXT,
  center_id UUID REFERENCES centers(id),
  consent BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patients_mobile ON patients(mobile);
CREATE INDEX IF NOT EXISTS idx_patients_mobile_name_dob ON patients(mobile, lower(full_name), dob);
CREATE INDEX IF NOT EXISTS idx_patients_center_id ON patients(center_id);

CREATE TABLE IF NOT EXISTS patient_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID UNIQUE NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  aadhaar_hash TEXT,
  aadhaar_last4 TEXT,
  abha_hash TEXT,
  abha_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_identifiers_aadhaar_hash ON patient_identifiers(aadhaar_hash) WHERE aadhaar_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_identifiers_abha_hash ON patient_identifiers(abha_hash) WHERE abha_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patient_identifiers_abha_number ON patient_identifiers(abha_number);

CREATE TABLE IF NOT EXISTS samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id TEXT UNIQUE NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id),
  center_id UUID NOT NULL REFERENCES centers(id),
  collection_mode TEXT NOT NULL CHECK (collection_mode IN ('PROVIDER_COLLECTED','SELF_SAMPLED')),
  collection_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  collected_by UUID REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('COLLECTED','DISPATCHED','RECEIVED_AT_HUB','IN_PROCESS','REPORTED','REFERRED')) DEFAULT 'COLLECTED',
  condition_status TEXT NOT NULL CHECK (condition_status IN ('OK','MISSING','DAMAGED')) DEFAULT 'OK',
  condition_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_samples_sample_id ON samples(sample_id);
CREATE INDEX IF NOT EXISTS idx_samples_status ON samples(status);
CREATE INDEX IF NOT EXISTS idx_samples_center_id ON samples(center_id);
CREATE INDEX IF NOT EXISTS idx_samples_patient_id ON samples(patient_id);

CREATE TABLE IF NOT EXISTS dispatch_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT UNIQUE NOT NULL,
  source_center_id UUID NOT NULL REFERENCES centers(id),
  hub_center_id UUID NOT NULL REFERENCES centers(id),
  status TEXT NOT NULL CHECK (status IN ('DISPATCHED','PARTIALLY_RECEIVED','RECEIVED','CLOSED')) DEFAULT 'DISPATCHED',
  sample_count INTEGER NOT NULL DEFAULT 0,
  courier_name TEXT,
  notes TEXT,
  dispatched_by UUID REFERENCES users(id),
  received_by UUID REFERENCES users(id),
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dispatch_batches_batch_id ON dispatch_batches(batch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_batches_status ON dispatch_batches(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_batches_center_id ON dispatch_batches(source_center_id);

CREATE TABLE IF NOT EXISTS dispatch_batch_samples (
  dispatch_batch_id UUID NOT NULL REFERENCES dispatch_batches(id) ON DELETE CASCADE,
  sample_id UUID NOT NULL REFERENCES samples(id),
  receive_status TEXT NOT NULL CHECK (receive_status IN ('PENDING','RECEIVED','MISSING','DAMAGED')) DEFAULT 'PENDING',
  receive_notes TEXT,
  PRIMARY KEY(dispatch_batch_id, sample_id)
);
CREATE INDEX IF NOT EXISTS idx_dispatch_batch_samples_sample_id ON dispatch_batch_samples(sample_id);

CREATE TABLE IF NOT EXISTS lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id UUID UNIQUE NOT NULL REFERENCES samples(id),
  result TEXT NOT NULL CHECK (result IN ('NEGATIVE','POSITIVE_HPV_16','POSITIVE_HPV_18','POSITIVE_OTHER_HR_HPV','INVALID_REPEAT_REQUIRED')),
  remarks TEXT,
  reported_by UUID REFERENCES users(id),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lab_results_result ON lab_results(result);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  sample_id UUID REFERENCES samples(id),
  lab_result_id UUID REFERENCES lab_results(id),
  result TEXT NOT NULL CHECK (result IN ('NEGATIVE','POSITIVE_HPV_16','POSITIVE_HPV_18','POSITIVE_OTHER_HR_HPV','INVALID_REPEAT_REQUIRED')),
  referred_to_center_id UUID REFERENCES centers(id),
  follow_up_status TEXT NOT NULL DEFAULT 'PENDING_CONTACT' CHECK (follow_up_status IN ('PENDING_CONTACT','CONTACTED','APPOINTMENT_GIVEN','VISITED','LOST_TO_FOLLOWUP','COMPLETED')),
  follow_up_date DATE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(follow_up_status);
CREATE INDEX IF NOT EXISTS idx_referrals_patient_id ON referrals(patient_id);
CREATE INDEX IF NOT EXISTS idx_referrals_sample_id ON referrals(sample_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS external_patient_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  center_id UUID REFERENCES centers(id),
  system_name TEXT NOT NULL,
  uhid TEXT,
  external_patient_id TEXT,
  external_visit_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(system_name, external_patient_id)
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL,
  target_system TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_events_status ON outbox_events(status);
CREATE INDEX IF NOT EXISTS idx_outbox_events_event_type ON outbox_events(event_type);
