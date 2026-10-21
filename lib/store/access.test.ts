import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { downloadDecision, hasStoreEntitlement } from './access';
import { canSignDownloads, canWriteStorage } from './setup';

describe('store download access', () => {
  it('lets staff review drafts and keeps paid files behind a purchase', () => {
    assert.equal(downloadDecision({
      contentStaff: true, access: 'paid', status: 'draft', purchased: false, entitled: false,
    }), 'allow');
    assert.equal(downloadDecision({
      contentStaff: false, access: 'paid', status: 'draft', purchased: true, entitled: false,
    }), 'deny');
    assert.equal(downloadDecision({
      contentStaff: false, access: 'paid', status: 'published', purchased: false, entitled: false,
    }), 'deny');
    assert.equal(downloadDecision({
      contentStaff: false, access: 'paid', status: 'published', purchased: true, entitled: false,
    }), 'allow');
    assert.equal(downloadDecision({
      contentStaff: false, access: 'free', status: 'published', purchased: false, entitled: false,
    }), 'allow');
    assert.equal(hasStoreEntitlement(['alloc:store:prod-1'], 'prod-1'), true);
    assert.equal(hasStoreEntitlement(['alloc:resource:prod-1'], 'prod-1'), true);
    assert.equal(hasStoreEntitlement(['alloc:store:other'], 'prod-1'), false);
  });

  it('signs only when the service account JSON contains a private key', () => {
    const previousAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    const previousStorage = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    const previousGoogle = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    process.env.FIREBASE_SERVICE_ACCOUNT = '{"client_email":"missing@poketschool.ai"}';
    assert.equal(canSignDownloads(), false);
    process.env.FIREBASE_SERVICE_ACCOUNT = 'not-json';
    assert.equal(canSignDownloads(), false);
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    assert.equal(canSignDownloads(), false);
    assert.equal(canWriteStorage(), false);
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
      private_key: '-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----\n',
    });
    assert.equal(canSignDownloads(), true);
    if (previousAccount === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT;
    else process.env.FIREBASE_SERVICE_ACCOUNT = previousAccount;
    if (previousStorage === undefined) delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    else process.env.FIREBASE_STORAGE_EMULATOR_HOST = previousStorage;
    if (previousGoogle === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = previousGoogle;
  });
});
