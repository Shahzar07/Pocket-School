import assert from 'node:assert/strict';
import test from 'node:test';
import { answerFromArticles, STARTER_ARTICLES } from './help-centre';
import { whatsAppPayload } from './messaging/whatsapp';
import { documentHash, myInvoisEnv, submissionBody } from './payments/myinvois-submit';
import { buildMyInvois } from './payments/tax';

test('MyInvois stays not configured when the keys are missing', () => {
  const env = myInvoisEnv({ clientId: '', clientSecret: 'secret', tin: '', mode: 'production' });
  assert.equal(env.ready, false);
  if (env.ready) return;
  assert.equal(env.status, 'not_configured');
  assert.match(env.detail, /MYINVOIS_CLIENT_ID/);
  assert.match(env.detail, /TIN/);
});

test('MyInvois uses the sandbox host unless production is set', () => {
  const sandbox = myInvoisEnv({ clientId: 'id', clientSecret: 'secret', tin: 'C123', mode: '' });
  const live = myInvoisEnv({ clientId: 'id', clientSecret: 'secret', tin: 'C123', mode: 'production' });
  assert.equal(sandbox.ready && sandbox.host.includes('preprod-api.myinvois'), true);
  assert.equal(live.ready && live.mode, 'production');
});

test('a MyInvois submission hashes the JSON document', () => {
  const document = buildMyInvois({
    currency: 'MYR',
    description: 'Course',
    taxExclusive: 10,
    tax: 0,
    buyer: { name: 'Ada' },
  });
  const body = submissionBody(document, 'INV-1');
  const json = JSON.stringify(document);
  assert.equal(body.documents[0]?.documentHash, documentHash(json));
  assert.equal(body.documents[0]?.format, 'JSON');
});

test('ET AI answers from a help article and asks for a ticket otherwise', () => {
  const hit = answerFromArticles('Where is my verification code?', STARTER_ARTICLES);
  assert.equal(hit.confident, true);
  assert.match(hit.answer, /verification code/i);
  const miss = answerFromArticles('banana smoothie recipe', STARTER_ARTICLES);
  assert.equal(miss.confident, false);
  assert.match(miss.answer, /helpdesk ticket/i);
});

test('WhatsApp sends a template payload', () => {
  const payload = whatsAppPayload('+60 12-345 6789', 'poket_otp', ['123456']);
  assert.equal(payload.to, '60123456789');
  assert.equal(payload.type, 'template');
  const template = payload.template as { name: string };
  assert.equal(template.name, 'poket_otp');
});
