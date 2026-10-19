import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONSENT_VERSION, signupConsentFields } from './consents';

test('sign-up stores each optional consent with a time and a version', () => {
  const fields = signupConsentFields({
    demographic: true,
    timezone: 'Asia/Kuala_Lumpur',
    timezoneOn: true,
    amber: false,
    now: 100,
  });
  assert.equal(fields.demographicConsent, true);
  assert.equal(fields.demographicConsentAt, 100);
  assert.equal(fields.demographicConsentVersion, CONSENT_VERSION);
  assert.equal(fields.timezone, 'Asia/Kuala_Lumpur');
  assert.equal(fields.timezoneAuto, true);
  assert.equal(fields.amberOptInVersion, CONSENT_VERSION);
});

test('a person can leave the detected timezone off', () => {
  const fields = signupConsentFields({
    demographic: false,
    timezone: 'Europe/London',
    timezoneOn: false,
    amber: true,
    now: 5,
  });
  assert.equal(fields.demographicConsent, false);
  assert.equal(fields.timezone, '');
  assert.equal(fields.timezoneAuto, false);
});
