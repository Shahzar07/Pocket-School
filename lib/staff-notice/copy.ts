/**
 * Lock-screen copy and staff recipient rules for safeguarding notices.
 * The push never carries a description, a phone number, or an email.
 */

export const DELIVERY_STATUSES = ['queued', 'sent', 'delivered', 'failed', 'opened'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const NOTICE_KINDS = ['danger_now', 'student_safety_report', 'safeguarding_ticket', 'emergency_alert'] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

export type NoticeCategory = 'emergency' | 'safety';

const TYPE_LABELS: Record<string, string> = {
  bullying: 'Bullying',
  cyberbullying: 'Cyberbullying',
  harassment: 'Harassment',
  abuse: 'Abuse',
  self_harm_concern: 'Self-harm concern',
  discrimination: 'Discrimination',
  unsafe_other: 'Safety report',
  danger_now: 'Danger now',
  safeguarding: 'Safeguarding',
  missing_child: 'Missing child',
  lockdown: 'Lockdown',
  weather: 'Weather',
  medical: 'Medical',
  general: 'Emergency',
};

export function noticeTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? 'Safeguarding';
}

/** First name and last initial. A single name stays as that name. */
export function lockScreenName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'A student';
  const first = parts[0] ?? 'A student';
  const last = parts.length > 1 ? parts[parts.length - 1] ?? '' : '';
  if (!last) return first;
  return `${first} ${last.slice(0, 1).toUpperCase()}.`;
}

export function clockLabel(at: number, timeZone = 'Asia/Kuala_Lumpur'): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(at));
  } catch {
    return new Date(at).toISOString().slice(11, 16);
  }
}

export function lockScreenNotice(input: {
  typeLabel: string;
  fullName: string;
  classLabel: string;
  at: number;
  timeZone?: string;
}): { title: string; body: string } {
  const name = input.fullName.trim() ? lockScreenName(input.fullName) : '';
  const classLabel = input.classLabel.trim();
  const who = [name, classLabel].filter(Boolean).join(' · ') || 'School';
  const time = clockLabel(input.at, input.timeZone);
  return {
    title: input.typeLabel.trim() || 'Safeguarding',
    body: `${who} · ${time}. Open case.`,
  };
}

export function noticeCategory(kind: NoticeKind): NoticeCategory {
  if (kind === 'student_safety_report') return 'safety';
  return 'emergency';
}

/** Safeguarding cases go to the safeguarding lead. Operational alerts go to the academic lead. */
export function headPost(kind: NoticeKind, alertType = ''): 'safeguarding_lead' | 'academic_lead' {
  if (kind === 'emergency_alert' && alertType !== 'missing_child' && alertType !== 'medical') {
    return 'academic_lead';
  }
  return 'safeguarding_lead';
}

/** Staff only. Parent accounts are removed even when they also hold a staff id. */
export function staffRecipients(input: {
  formTeacherUid: string;
  headUids: readonly string[];
  principalUids: readonly string[];
  parentUids: readonly string[];
}): string[] {
  const parents = new Set(input.parentUids.filter(Boolean));
  const ids = [input.formTeacherUid, ...input.headUids, ...input.principalUids];
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const id of ids) {
    if (!id || parents.has(id) || seen.has(id)) continue;
    seen.add(id);
    recipients.push(id);
  }
  return recipients;
}

export function deliveryExtra(input: {
  channel: 'push' | 'email';
  recipientUid: string;
  status: DeliveryStatus;
  provider: string;
  providerId: string;
  error?: string;
  fallback?: 'push' | 'email' | '';
}): Record<string, string> {
  return {
    channel: input.channel,
    recipientUid: input.recipientUid,
    status: input.status,
    provider: input.provider,
    providerId: input.providerId,
    error: input.error ?? '',
    fallback: input.fallback ?? '',
  };
}

export function fallbackChannel(pushFailed: boolean, emailFailed: boolean): 'push' | 'email' | '' {
  if (pushFailed && !emailFailed) return 'email';
  if (emailFailed && !pushFailed) return 'push';
  return '';
}
