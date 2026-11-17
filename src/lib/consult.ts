/**
 * Doctor consultation rules shared by the browser and server functions.
 * Pure module: no Supabase or browser imports, so it is safe to unit test.
 */

/** Consultation fee in paise (₹499), charged through Razorpay. */
export const CONSULT_FEE_PAISE = 49900;
export const CONSULT_CURRENCY = "INR";
export const CONSULT_TIMEZONE = "Asia/Kolkata";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
/** Slots must start at least this long from now to be bookable. */
export const BOOKING_LEAD_MS = 30 * 60 * 1000;
export const BOOKING_WINDOW_DAYS = 7;

export function formatInr(paise: number) {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees.toString() : rupees.toFixed(2)}`;
}

export type Condition = "Tuberculosis" | "Pneumonia";

type ScanSignals = {
  tb_probability: number;
  ai_status: string;
  ai_label: string | null;
};

/** Conditions detected on a scan that make a doctor consultation available. */
export function detectedConditions(scan: ScanSignals, tbThreshold = 0.5): Condition[] {
  const found = new Set<Condition>();
  if (scan.tb_probability >= tbThreshold) found.add("Tuberculosis");
  if (scan.ai_status === "done") {
    if (scan.ai_label === "Tuberculosis") found.add("Tuberculosis");
    if (scan.ai_label === "Pneumonia") found.add("Pneumonia");
  }
  return (["Tuberculosis", "Pneumonia"] as const).filter((c) => found.has(c));
}

export type Doctor = {
  id: string;
  name: string;
  specialty: string;
  experienceYears: number;
  languages: string[];
  treats: Condition[];
  /** Days of week (0 = Sunday) the doctor consults. */
  days: number[];
  /** Slot start times in IST, "HH:MM". */
  times: string[];
};

/** Demo doctors for the project. */
export const DOCTORS: Doctor[] = [
  {
    id: "dr-ananya-sharma",
    name: "Dr. Ananya Sharma",
    specialty: "Pulmonologist",
    experienceYears: 12,
    languages: ["English", "Hindi"],
    treats: ["Tuberculosis", "Pneumonia"],
    days: [1, 2, 3, 4, 5, 6],
    times: ["10:00", "10:30", "11:00", "11:30", "12:00", "16:00", "16:30", "17:00", "17:30"],
  },
  {
    id: "dr-rohan-mehta",
    name: "Dr. Rohan Mehta",
    specialty: "TB & chest specialist",
    experienceYears: 18,
    languages: ["English", "Hindi", "Gujarati"],
    treats: ["Tuberculosis"],
    days: [1, 3, 5, 6],
    times: ["09:30", "10:00", "10:30", "11:00", "18:00", "18:30", "19:00"],
  },
  {
    id: "dr-kavita-iyer",
    name: "Dr. Kavita Iyer",
    specialty: "Infectious disease physician",
    experienceYears: 9,
    languages: ["English", "Tamil", "Hindi"],
    treats: ["Pneumonia", "Tuberculosis"],
    days: [2, 4, 6],
    times: ["11:00", "11:30", "12:00", "12:30", "15:00", "15:30", "16:00"],
  },
];

export function doctorById(id: string) {
  return DOCTORS.find((d) => d.id === id);
}

/** "YYYY-MM-DD" of the given instant in India time. */
export function istDateKey(at: Date) {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function dayOfWeek(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

function addDays(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** All slot instants (ISO, UTC) a doctor offers on an IST date, ignoring bookings and time of day. */
export function doctorSlotsOn(doctor: Doctor, dateKey: string): string[] {
  if (!doctor.days.includes(dayOfWeek(dateKey))) return [];
  return doctor.times.map((t) => new Date(`${dateKey}T${t}:00+05:30`).toISOString());
}

/** Slots still bookable (far enough in the future) on an IST date. */
export function bookableSlotsOn(doctor: Doctor, dateKey: string, now: Date): string[] {
  const earliest = now.getTime() + BOOKING_LEAD_MS;
  return doctorSlotsOn(doctor, dateKey).filter((iso) => new Date(iso).getTime() >= earliest);
}

/** Upcoming IST dates (within the booking window) where the doctor has at least one bookable slot. */
export function upcomingDays(doctor: Doctor, now: Date): string[] {
  const today = istDateKey(now);
  const days: string[] = [];
  for (let i = 0; i < BOOKING_WINDOW_DAYS; i++) {
    const key = addDays(today, i);
    if (bookableSlotsOn(doctor, key, now).length > 0) days.push(key);
  }
  return days;
}

/** True when the slot is one the doctor offers, inside the booking window, and not too soon. */
export function isBookableSlot(doctorId: string, slotIso: string, now: Date) {
  const doctor = doctorById(doctorId);
  const at = new Date(slotIso);
  if (!doctor || Number.isNaN(at.getTime())) return false;
  const key = istDateKey(at);
  if (!upcomingDays(doctor, now).includes(key)) return false;
  return bookableSlotsOn(doctor, key, now).includes(at.toISOString());
}

/** Accepts Indian mobile numbers with optional +91/0 prefix and spaces; returns 10 digits or null. */
export function normalizeIndianPhone(input: string): string | null {
  let digits = input.replace(/[\s()-]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function formatSlot(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: CONSULT_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatSlotTime(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: CONSULT_TIMEZONE, hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export function formatDateKey(dateKey: string) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${dateKey}T00:00:00Z`),
  );
}
