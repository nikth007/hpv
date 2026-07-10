export function todayCode() {
  const d = new Date();
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function randomSuffix(length = 5) {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase();
}

export function patientCode(facilityCode = 'HPV') {
  return `PT-${facilityCode}-${todayCode()}-${randomSuffix(4)}`;
}

export function sampleBarcode(facilityCode = 'HPV') {
  return `HPV-${facilityCode}-${todayCode()}-${randomSuffix(6)}`;
}

export function batchCode(facilityCode = 'HPV') {
  return `BATCH-${facilityCode}-${todayCode()}-${randomSuffix(4)}`;
}
