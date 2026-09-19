export type AuthProvider = 'email' | 'google' | 'anonymous';

export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function sanitizeDisplayName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

export function validateAgeGate(dob: string) {
  if (!dob) return false;

  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return false;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const cutoffMonth = today.getMonth() - birth.getMonth();
  const cutoffDay = today.getDate() - birth.getDate();

  if (cutoffMonth < 0 || (cutoffMonth === 0 && cutoffDay < 0)) {
    age -= 1;
  }

  return age >= 13;
}
