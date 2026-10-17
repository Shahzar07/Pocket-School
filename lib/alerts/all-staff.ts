/**
 * All-staff alert. A tier-3 principal or safeguarding lead widens a case
 * or emergency to every staff member at the school. The staff view never
 * carries the private report, the evidence, or the child's identity.
 */

export const ALL_STAFF_TYPES = [
  'lockdown',
  'intruder',
  'missing_child_on_site',
  'fire_evacuation',
  'medical',
] as const;
export type AllStaffType = (typeof ALL_STAFF_TYPES)[number];

export const INSTRUCTION_LANGS = ['en', 'ms', 'zh', 'ta'] as const;
export type InstructionLang = (typeof INSTRUCTION_LANGS)[number];

export type CheckInStatus = 'safe' | 'need_help' | 'no_response';

export const ALL_STAFF_LABELS: Record<AllStaffType, string> = {
  lockdown: 'Lockdown',
  intruder: 'Intruder',
  missing_child_on_site: 'Missing child on site',
  fire_evacuation: 'Fire evacuation',
  medical: 'Medical',
};

const DEFAULT_INSTRUCTIONS: Record<AllStaffType, Record<InstructionLang, string>> = {
  lockdown: {
    en: 'Stay in the room. Lock the door. Stay quiet and away from windows. Wait for an all-clear.',
    ms: 'Kekal di dalam bilik. Kunci pintu. Bertenang dan jauhi tingkap. Tunggu isyarat selamat.',
    zh: '留在室内。锁门。保持安静，远离窗户。等待解除警报。',
    ta: 'அறையிலேயே இருங்கள். கதவைப் பூட்டுங்கள். அமைதியாக ஜன்னல்களிலிருந்து விலகி இருங்கள். பாதுகாப்பு அறிவிப்புக்காக காத்திருங்கள்.',
  },
  intruder: {
    en: 'Lock the door. Hide out of sight. Silence phones. Do not open the door.',
    ms: 'Kunci pintu. Sembunyi di luar pandangan. Senyapkan telefon. Jangan buka pintu.',
    zh: '锁门。躲到看不见的地方。手机静音。不要开门。',
    ta: 'கதவைப் பூட்டுங்கள். பார்வையில் படாமல் மறையுங்கள். தொலைபேசியை அமைதியாக்குங்கள். கதவைத் திறக்காதீர்கள்.',
  },
  missing_child_on_site: {
    en: 'Search your area. Do not approach alone. Tell the office if you see the child. Do not share their name.',
    ms: 'Periksa kawasan anda. Jangan dekati seorang diri. Beritahu pejabat jika anda nampak kanak-kanak itu. Jangan sebar nama.',
    zh: '搜查你所在的区域。不要独自靠近。看到孩子请告诉办公室。不要公开姓名。',
    ta: 'உங்கள் பகுதியைத் தேடுங்கள். தனியாக நெருங்காதீர்கள். குழந்தையைக் கண்டால் அலுவலகத்துக்குத் தெரிவியுங்கள். பெயரைப் பகிர வேண்டாம்.',
  },
  fire_evacuation: {
    en: 'Leave by the nearest exit. Do not use lifts. Go to the assembly point. Do not return for belongings.',
    ms: 'Keluar melalui pintu terdekat. Jangan guna lif. Pergi ke tempat perhimpunan. Jangan kembali mengambil barang.',
    zh: '从最近的出口离开。不要使用电梯。到集合点集合。不要返回取物品。',
    ta: 'அருகிலுள்ள வழியாக வெளியேறுங்கள். லிஃப்ட் பயன்படுத்த வேண்டாம். கூடும் இடத்துக்குச் செல்லுங்கள். பொருட்களுக்காகத் திரும்பி வராதீர்கள்.',
  },
  medical: {
    en: 'Keep the area clear. Send for the first-aider. Do not move the person unless they are in danger.',
    ms: 'Kosongkan kawasan. Panggil petugas pertolongan cemas. Jangan gerakkan orang itu kecuali mereka dalam bahaya.',
    zh: '保持现场畅通。请急救员到场。除非有危险，不要移动伤者。',
    ta: 'இடத்தை காலியாக வையுங்கள். முதலுதவி செய்பவரை அழைக்கவும். ஆபத்தில் இல்லையென்றால் நபரை நகர்த்த வேண்டாம்.',
  },
};

export function isAllStaffType(value: string): value is AllStaffType {
  return (ALL_STAFF_TYPES as readonly string[]).includes(value);
}

/** Tier 3 or higher, and only a principal or safeguarding lead. */
export function canWidenAllStaff(staffPost: string, verificationTier: number): boolean {
  if (verificationTier < 3) return false;
  return staffPost === 'principal' || staffPost === 'safeguarding_lead';
}

export function widenProblem(input: {
  staffPost: string;
  verificationTier: number;
  type: string;
  location: string;
  reason: string;
}): string | null {
  if (!canWidenAllStaff(input.staffPost, input.verificationTier)) {
    return 'A tier 3 principal or safeguarding lead can widen this to all staff.';
  }
  if (!isAllStaffType(input.type)) return 'Choose an all-staff alert type.';
  if (input.location.trim().length < 2) return 'Add the location in school.';
  if (input.reason.trim().length < 3) return 'Widening needs a reason.';
  return null;
}

export function languageOf(locale: string): InstructionLang {
  const key = locale.trim().toLowerCase();
  if (key === 'ms' || key.startsWith('ms-')) return 'ms';
  if (key === 'ta' || key.startsWith('ta-')) return 'ta';
  if (key === 'zh' || key.startsWith('zh')) return 'zh';
  return 'en';
}

export function defaultInstruction(type: AllStaffType, language: string): string {
  const lang = languageOf(language);
  return DEFAULT_INSTRUCTIONS[type][lang];
}

/** School text wins for that language. Other languages keep their own preset. */
export function instructionText(
  type: AllStaffType,
  custom: Partial<Record<InstructionLang, string>> | undefined,
  language: string,
): string {
  const lang = languageOf(language);
  const edited = custom?.[lang]?.trim();
  if (edited) return edited;
  return DEFAULT_INSTRUCTIONS[type][lang];
}

export interface StaffAlertView {
  id: string;
  type: AllStaffType;
  typeLabel: string;
  location: string;
  instruction: string;
  status: 'open' | 'cleared';
  publicDescription: string;
  checkIn: CheckInStatus;
}

/** Strips the report, the evidence, and the child's identity. */
export function staffAlertView(input: {
  id: string;
  type: AllStaffType;
  location: string;
  instruction: string;
  status: 'open' | 'cleared';
  publicDescription?: string;
  checkIn?: CheckInStatus;
  childName?: string;
  body?: string;
  evidence?: unknown;
  studentId?: string;
}): StaffAlertView {
  const description = input.type === 'missing_child_on_site' ? (input.publicDescription ?? '').trim() : '';
  return {
    id: input.id,
    type: input.type,
    typeLabel: ALL_STAFF_LABELS[input.type],
    location: input.location,
    instruction: input.instruction,
    status: input.status,
    publicDescription: description,
    checkIn: input.checkIn ?? 'no_response',
  };
}

export function rollCallCounts(
  staffUids: readonly string[],
  checkins: readonly { uid: string; status: 'safe' | 'need_help' }[],
): { safe: number; needHelp: number; noResponse: number } {
  const byUid = new Map(checkins.map(row => [row.uid, row.status]));
  let safe = 0;
  let needHelp = 0;
  let noResponse = 0;
  for (const uid of staffUids) {
    const status = byUid.get(uid);
    if (status === 'safe') safe += 1;
    else if (status === 'need_help') needHelp += 1;
    else noResponse += 1;
  }
  return { safe, needHelp, noResponse };
}

export function checkInProblem(alertStatus: string, choice: string): string | null {
  if (alertStatus !== 'open') return 'Roll-call is closed.';
  if (choice !== 'safe' && choice !== 'need_help') return 'Choose I am safe or Need help.';
  return null;
}

export function cleanInstruction(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 500);
}
