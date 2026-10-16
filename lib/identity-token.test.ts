import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { identityFromPayload, lookupIdToken } from './identity-token';

const PROJECT_ID = 'ringed-sentinel-436615-c2';

test('identity claims come from the token payload, lowercased', () => {
  const identity = identityFromPayload({
    sub: 'uid-1',
    email: 'Harry.Seggu@gmail.com',
    role: 'admin',
    adminRole: 'super_admin',
  });
  assert.deepEqual(identity, {
    uid: 'uid-1',
    email: 'harry.seggu@gmail.com',
    customAttributes: { role: 'admin', adminRole: 'super_admin' },
  });
  assert.equal(identityFromPayload({ sub: 'uid-1' }), null);
  assert.equal(identityFromPayload({ email: 'owner@example.com' }), null);
});

test('a token that is not a Firebase ID token does not verify', async () => {
  assert.equal(await lookupIdToken(''), null);
  assert.equal(await lookupIdToken('not-a-firebase-id-token'), null);
});

test('only an RS256 token for this project verifies', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test-key';
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('securetoken@system.gserviceaccount.com')) {
      return new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return original(input, init);
  };

  const sign = (claims: { issuer: string; audience: string }) => new SignJWT({
    email: 'Harry.Seggu@gmail.com',
    adminRole: 'super_admin',
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject('uid-owner')
    .setIssuer(claims.issuer)
    .setAudience(claims.audience)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  try {
    const good = await sign({
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    const identity = await lookupIdToken(`  ${good}  `);
    assert.equal(identity?.uid, 'uid-owner');
    assert.equal(identity?.email, 'harry.seggu@gmail.com');
    assert.equal(identity?.customAttributes.adminRole, 'super_admin');

    const otherProject = await sign({
      issuer: 'https://securetoken.google.com/other-project',
      audience: 'other-project',
    });
    assert.equal(await lookupIdToken(otherProject), null);
  } finally {
    globalThis.fetch = original;
  }
});
