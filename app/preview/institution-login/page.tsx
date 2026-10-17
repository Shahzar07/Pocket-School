'use client';

import { InstitutionLoginScreen } from '@/components/institution-login-screen';

/** Static branded login so the page can be reviewed without a live academy. */
export default function InstitutionLoginPreview() {
  return (
    <InstitutionLoginScreen
      schoolName="North Academy"
      logoUrl={null}
      primaryColor="#203337"
      secondaryColor="#1E6A83"
      headline="Welcome back to North Academy"
      body="Students, teachers, and institution admins sign in here."
      showPoweredBy
      status="ready"
      step="credentials"
      signupPolicy="invite"
      onCredentials={() => undefined}
      onGoogle={() => undefined}
      onVerify={() => undefined}
      onResend={() => undefined}
      onCancel={() => undefined}
    />
  );
}
