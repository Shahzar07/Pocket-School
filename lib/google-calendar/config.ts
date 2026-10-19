export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
] as const;

export const GOOGLE_CALENDAR_SCOPE = GOOGLE_CALENDAR_SCOPES.join(' ');

export const POKET_CALENDAR_NAME = 'Poket School';

/** School clock for Google dateTime values. Malaysia is the home time zone. */
export const SCHOOL_TIME_ZONE = 'Asia/Kuala_Lumpur';

export interface GoogleCalendarEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function googleCalendarEnv(source: NodeJS.ProcessEnv = process.env): GoogleCalendarEnv {
  return {
    clientId: source.GOOGLE_CLIENT_ID?.trim() ?? '',
    clientSecret: source.GOOGLE_CLIENT_SECRET?.trim() ?? '',
    redirectUri: source.GOOGLE_OAUTH_REDIRECT_URI?.trim() ?? '',
  };
}

export function googleCalendarConfigured(env: GoogleCalendarEnv = googleCalendarEnv()): boolean {
  return Boolean(env.clientId && env.clientSecret && env.redirectUri);
}

/** Signs the iCal subscription. Google OAuth is not required. */
export function feedSecret(source: NodeJS.ProcessEnv = process.env): string {
  const named = source.OTP_SECRET?.trim() || source.DASHBOARD_SESSION_SECRET?.trim() || source.GOOGLE_CLIENT_SECRET?.trim();
  return named || 'poket-school-calendar-feed';
}
