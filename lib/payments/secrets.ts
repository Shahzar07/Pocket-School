/**
 * Every secret the payments and integrations consoles know about.
 * Values are read from the environment first, then from Firestore
 * `platform_secrets/{id}`, which clients cannot read. The admin API returns
 * the masked form only.
 */

export type SecretGroup = 'payments' | 'meetings' | 'messaging' | 'identity' | 'notifications' | 'ai' | 'tax';

export interface SecretSlot {
  id: string;
  label: string;
  envVar: string;
  group: SecretGroup;
  flag: string;
  required: boolean;
  why: string;
}

export const SECRET_SLOTS: readonly SecretSlot[] = [
  { id: 'stripe_secret', label: 'Stripe secret key', envVar: 'STRIPE_SECRET_KEY', group: 'payments', flag: 'payments.stripe', required: true, why: 'Charges cards, Apple Pay, Google Pay, FPX, GrabPay, Billing and refunds.' },
  { id: 'stripe_publishable', label: 'Stripe publishable key', envVar: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', group: 'payments', flag: 'payments.stripe', required: false, why: 'Reserved for a future in-page card element. Hosted Checkout works without it.' },
  { id: 'stripe_webhook', label: 'Stripe webhook secret', envVar: 'STRIPE_WEBHOOK_SECRET', group: 'payments', flag: 'payments.stripe', required: true, why: 'Verifies that entitlement grants came from Stripe.' },
  { id: 'ipay88_code', label: 'iPay88 merchant code', envVar: 'IPAY88_MERCHANT_CODE', group: 'payments', flag: 'payments.my_gateway', required: false, why: 'Required only when the Malaysian gateway is set to iPay88.' },
  { id: 'ipay88_key', label: 'iPay88 merchant key', envVar: 'IPAY88_MERCHANT_KEY', group: 'payments', flag: 'payments.my_gateway', required: false, why: 'Signs iPay88 payments and callbacks.' },
  { id: 'billplz_key', label: 'Billplz API secret key', envVar: 'BILLPLZ_API_KEY', group: 'payments', flag: 'payments.my_gateway', required: false, why: 'Required only when the Malaysian gateway is set to Billplz.' },
  { id: 'billplz_collection', label: 'Billplz collection ID', envVar: 'BILLPLZ_COLLECTION_ID', group: 'payments', flag: 'payments.my_gateway', required: false, why: 'Billplz collection that receives Poket School bills.' },
  { id: 'billplz_signature', label: 'Billplz X Signature key', envVar: 'BILLPLZ_X_SIGNATURE', group: 'payments', flag: 'payments.my_gateway', required: false, why: 'Verifies Billplz callbacks.' },
  { id: 'rms_merchant', label: 'RMS merchant ID', envVar: 'RMS_MERCHANT_ID', group: 'payments', flag: 'payments.my_gateway', required: false, why: 'Required only when the Malaysian gateway is set to Razer Merchant Services.' },
  { id: 'rms_verify', label: 'RMS verify key', envVar: 'RMS_VERIFY_KEY', group: 'payments', flag: 'payments.my_gateway', required: false, why: 'RMS request signing key.' },
  { id: 'rms_secret', label: 'RMS secret key', envVar: 'RMS_SECRET_KEY', group: 'payments', flag: 'payments.my_gateway', required: false, why: 'Verifies RMS callbacks.' },
  { id: 'myinvois_id', label: 'MyInvois client ID', envVar: 'MYINVOIS_CLIENT_ID', group: 'tax', flag: 'payments.myinvois', required: false, why: 'LHDN e-invoice client. Invoices are stored ready before this exists.' },
  { id: 'myinvois_secret', label: 'MyInvois client secret', envVar: 'MYINVOIS_CLIENT_SECRET', group: 'tax', flag: 'payments.myinvois', required: false, why: 'LHDN e-invoice secret. Submission stays off until both MyInvois keys exist.' },
  { id: 'zoom_account', label: 'Zoom account ID', envVar: 'ZOOM_ACCOUNT_ID', group: 'meetings', flag: 'integrations.zoom', required: false, why: 'Server-to-server OAuth for Zoom meetings.' },
  { id: 'zoom_client', label: 'Zoom client ID', envVar: 'ZOOM_CLIENT_ID', group: 'meetings', flag: 'integrations.zoom', required: false, why: 'Zoom app client ID.' },
  { id: 'zoom_secret', label: 'Zoom client secret', envVar: 'ZOOM_CLIENT_SECRET', group: 'meetings', flag: 'integrations.zoom', required: false, why: 'Zoom app client secret.' },
  { id: 'meet_client', label: 'Google Meet client ID', envVar: 'GOOGLE_MEET_CLIENT_ID', group: 'meetings', flag: 'integrations.meet', required: false, why: 'Google OAuth client for Meet.' },
  { id: 'meet_secret', label: 'Google Meet client secret', envVar: 'GOOGLE_MEET_CLIENT_SECRET', group: 'meetings', flag: 'integrations.meet', required: false, why: 'Google OAuth secret for Meet.' },
  { id: 'teams_client', label: 'Teams client ID', envVar: 'TEAMS_CLIENT_ID', group: 'meetings', flag: 'integrations.teams', required: false, why: 'Microsoft Entra application for Teams.' },
  { id: 'teams_secret', label: 'Teams client secret', envVar: 'TEAMS_CLIENT_SECRET', group: 'meetings', flag: 'integrations.teams', required: false, why: 'Microsoft Entra client secret.' },
  { id: 'teams_tenant', label: 'Teams tenant ID', envVar: 'TEAMS_TENANT_ID', group: 'meetings', flag: 'integrations.teams', required: false, why: 'Microsoft Entra tenant.' },
  { id: 'whatsapp_token', label: 'WhatsApp access token', envVar: 'WHATSAPP_TOKEN', group: 'messaging', flag: 'integrations.whatsapp', required: false, why: 'WhatsApp Business Cloud API token.' },
  { id: 'whatsapp_phone', label: 'WhatsApp phone number ID', envVar: 'WHATSAPP_PHONE_NUMBER_ID', group: 'messaging', flag: 'integrations.whatsapp', required: false, why: 'WhatsApp Business phone number ID.' },
  { id: 'smtp_host', label: 'SMTP host', envVar: 'SMTP_HOST', group: 'messaging', flag: 'integrations.smtp', required: false, why: 'Already used for signup codes. The checklist shows when it is missing.' },
  { id: 'smtp_user', label: 'SMTP user', envVar: 'SMTP_USER', group: 'messaging', flag: 'integrations.smtp', required: false, why: 'SMTP username.' },
  { id: 'smtp_pass', label: 'SMTP password', envVar: 'SMTP_PASS', group: 'messaging', flag: 'integrations.smtp', required: false, why: 'SMTP password or app password.' },
  { id: 'saml_entry', label: 'SAML entry point', envVar: 'SAML_ENTRY_POINT', group: 'identity', flag: 'integrations.saml', required: false, why: 'Identity provider SSO URL.' },
  { id: 'saml_issuer', label: 'SAML issuer', envVar: 'SAML_ISSUER', group: 'identity', flag: 'integrations.saml', required: false, why: 'SAML entity ID.' },
  { id: 'saml_cert', label: 'SAML certificate', envVar: 'SAML_CERT', group: 'identity', flag: 'integrations.saml', required: false, why: 'IdP signing certificate.' },
  { id: 'oidc_issuer', label: 'OIDC issuer', envVar: 'OIDC_ISSUER', group: 'identity', flag: 'integrations.saml', required: false, why: 'OpenID Connect issuer URL. SSO stays on email invites until this set is complete.' },
  { id: 'oidc_client', label: 'OIDC client ID', envVar: 'OIDC_CLIENT_ID', group: 'identity', flag: 'integrations.saml', required: false, why: 'OpenID Connect client ID.' },
  { id: 'oidc_secret', label: 'OIDC client secret', envVar: 'OIDC_CLIENT_SECRET', group: 'identity', flag: 'integrations.saml', required: false, why: 'OpenID Connect client secret.' },
  { id: 'scim_token', label: 'SCIM bearer token', envVar: 'SCIM_BEARER_TOKEN', group: 'identity', flag: 'integrations.saml', required: false, why: 'Bearer token a directory uses to provision academy members. Invites still work without it.' },
  { id: 'lti_client', label: 'LTI client ID', envVar: 'LTI_CLIENT_ID', group: 'identity', flag: 'integrations.lti', required: false, why: 'LTI 1.3 tool client ID.' },
  { id: 'lti_deployment', label: 'LTI deployment ID', envVar: 'LTI_DEPLOYMENT_ID', group: 'identity', flag: 'integrations.lti', required: false, why: 'LTI deployment ID.' },
  { id: 'lti_key', label: 'LTI private key', envVar: 'LTI_PRIVATE_KEY', group: 'identity', flag: 'integrations.lti', required: false, why: 'Signs LTI launches.' },
  { id: 'fcm', label: 'FCM service account', envVar: 'FCM_SERVICE_ACCOUNT', group: 'notifications', flag: 'integrations.fcm', required: false, why: 'Firebase Cloud Messaging for web and Android push.' },
  { id: 'expo', label: 'Expo access token', envVar: 'EXPO_ACCESS_TOKEN', group: 'notifications', flag: 'integrations.expo', required: false, why: 'Expo push notifications.' },
  { id: 'openrouter', label: 'OpenRouter API key', envVar: 'OPENROUTER_API_KEY', group: 'ai', flag: 'integrations.openrouter', required: true, why: 'AI Studio and lesson generation.' },
  { id: 'gemini', label: 'Gemini API key', envVar: 'GEMINI_API_KEY', group: 'ai', flag: 'integrations.gemini', required: false, why: 'Gemini calls. A monthly spend cap is set beside the key, not inside it.' },
  { id: 'ocr', label: 'OCR API key', envVar: 'OCR_API_KEY', group: 'ai', flag: 'integrations.ocr', required: false, why: 'Document OCR provider key.' },
  { id: 'speech', label: 'Speech API key', envVar: 'SPEECH_API_KEY', group: 'ai', flag: 'integrations.speech', required: false, why: 'Speech-to-text or text-to-speech provider key.' },
];

export interface SetupAccount {
  account: string;
  where: string;
  tasks: string[];
  keys: { envVar: string; required: boolean; why: string }[];
}

/** The list Harry has to provision. Kept next to the slots so the admin checklist cannot drift. */
export function harrySetup(): SetupAccount[] {
  return [
    {
      account: 'Stripe (the legal entity that will charge learners)',
      where: 'https://dashboard.stripe.com',
      tasks: [
        'Create the account and finish business verification.',
        'Enable cards, Apple Pay, Google Pay, FPX and GrabPay. Leave dynamic payment methods on so new regional methods appear without a code change.',
        'Register the production domain for Apple Pay.',
        'Turn on Stripe Connect with Express accounts for teacher and tutor payouts.',
        'Add a webhook endpoint pointing at /api/stripe/webhook for checkout.session.completed, invoice.paid, customer.subscription.deleted, charge.refunded and charge.dispute.created.',
        'Use sk_test / pk_test / whsec_ test keys until Harry switches the account to live. Do not deploy live keys for this pull request.',
      ],
      keys: slots('payments.stripe').map(brief),
    },
    {
      account: 'One Malaysian gateway: Billplz, iPay88, or Razer Merchant Services',
      where: 'Set MY_GATEWAY_PROVIDER to billplz, ipay88, or rms. The default is billplz.',
      tasks: [
        'Open a sandbox account with the chosen gateway.',
        'Enable Touch \'n Go, Boost, ShopeePay and DuitNow QR.',
        'Point the callback at /api/payments/webhook/gateway.',
        'Supply only the keys for the chosen gateway. The other gateway keys can stay empty.',
      ],
      keys: SECRET_SLOTS.filter((slot) => slot.flag === 'payments.my_gateway').map(brief),
    },
    {
      account: 'MyInvois (LHDN) — readiness only',
      where: 'https://myinvois.hasil.gov.my',
      tasks: [
        'Invoices are stored with SST and a MyInvois document. Nothing is submitted until these keys exist and the payments.myinvois flag is switched on.',
        'Confirm the classification code. The console defaults to 022 until the accountant replaces it.',
        'Put the supplier TIN and SSM number in the Payments tax panel. Those are not API secrets.',
      ],
      keys: slots('payments.myinvois').map(brief),
    },
    {
      account: 'Firebase Admin for project ringed-sentinel-436615-c2',
      where: 'Firebase console → Project settings → Service accounts',
      tasks: ['The existing Admin SDK service account must stay on the server. Payments writes entitlements with it. Clients cannot grant themselves a plan.'],
      keys: [{ envVar: 'FIREBASE_SERVICE_ACCOUNT', required: true, why: 'Server writes for checkout, webhooks, wallet and invoices.' }],
    },
    {
      account: 'Zoom, Google Meet and Microsoft Teams',
      where: 'Each vendor’s developer console',
      tasks: ['Leave the flags off until the sandbox app exists. Test connection stays in mock mode with no keys.'],
      keys: [...slots('integrations.zoom'), ...slots('integrations.meet'), ...slots('integrations.teams')].map(brief),
    },
    {
      account: 'WhatsApp Business and SMTP',
      where: 'Meta Business Suite, and the mailbox already used for signup codes',
      tasks: ['SMTP keys may already be set. WhatsApp stays off until a phone number ID exists.'],
      keys: [...slots('integrations.whatsapp'), ...SECRET_SLOTS.filter((slot) => slot.group === 'messaging' && slot.flag === 'integrations.smtp')].map(brief),
    },
    {
      account: 'SSO (SAML or OIDC), SCIM and LTI',
      where: 'The school identity provider, and the LTI platform',
      tasks: [
        'Institution plans mention SSO and directory provisioning. The flag stays off until a school is ready to connect.',
        'Without these keys, academies stay on email and join links.',
      ],
      keys: [...slots('integrations.saml'), ...slots('integrations.lti')].map(brief),
    },
    {
      account: 'FCM and Expo',
      where: 'Firebase Cloud Messaging and Expo',
      tasks: ['Push stays off until a device build needs it.'],
      keys: [...slots('integrations.fcm'), ...slots('integrations.expo')].map(brief),
    },
    {
      account: 'OpenRouter, Gemini, OCR and speech',
      where: 'Each provider’s API keys page',
      tasks: ['Set a monthly spend cap in the Integrations console after the key is stored. The cap is a number, not a secret.'],
      keys: SECRET_SLOTS.filter((slot) => slot.group === 'ai').map(brief),
    },
  ];
}

function slots(flag: string): SecretSlot[] {
  return SECRET_SLOTS.filter((slot) => slot.flag === flag);
}

function brief(slot: SecretSlot): { envVar: string; required: boolean; why: string } {
  return { envVar: slot.envVar, required: slot.required, why: slot.why };
}

const PLACEHOLDERS = new Set([
  'MY_GEMINI_API_KEY',
  'YOUR_OPENROUTER_API_KEY',
  'MY_APP_URL',
  'you@gmail.com',
  'your-app-password',
  'any-long-random-string',
  'changeme',
]);

export function isPlaceholder(value: string | undefined | null): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (PLACEHOLDERS.has(trimmed)) return true;
  if (trimmed.startsWith('YOUR_') || trimmed.startsWith('MY_')) return true;
  return false;
}

export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export interface SecretView {
  id: string;
  label: string;
  envVar: string;
  group: SecretGroup;
  flag: string;
  required: boolean;
  why: string;
  state: 'missing' | 'env' | 'stored';
  masked: string | null;
}

export function describeSecret(
  slot: SecretSlot,
  envValue: string | undefined,
  storedMasked: string | null,
): SecretView {
  const base = {
    id: slot.id,
    label: slot.label,
    envVar: slot.envVar,
    group: slot.group,
    flag: slot.flag,
    required: slot.required,
    why: slot.why,
  };
  if (!isPlaceholder(envValue)) {
    return { ...base, state: 'env', masked: maskSecret(envValue ?? '') };
  }
  if (storedMasked) return { ...base, state: 'stored', masked: storedMasked };
  return { ...base, state: 'missing', masked: null };
}

export function missingRequired(views: SecretView[]): SecretView[] {
  return views.filter((view) => view.required && view.state === 'missing');
}
