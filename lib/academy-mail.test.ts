import assert from 'node:assert/strict';
import test from 'node:test';
import { brandedMailHtml, mailBrandFromInstitution, mailFromHeader, smtpMailbox } from './academy-mail';
import { accentInk } from './white-label';

test('academy mail keeps the SMTP address and uses the academy from-name', () => {
  const env = { SMTP_FROM: 'Poket School <hello@poketschool.ai>', SMTP_USER: 'hello@poketschool.ai' };
  assert.equal(smtpMailbox(env), 'hello@poketschool.ai');
  assert.equal(mailFromHeader('North Academy Office', env), 'North Academy Office <hello@poketschool.ai>');
  assert.equal(mailFromHeader(undefined, env), 'Poket School <hello@poketschool.ai>');
  const brand = mailBrandFromInstitution({
    name: 'North Academy',
    branding: { emailFromName: 'North Office', logoUrl: 'https://cdn.example/north.png', primaryColor: '#9A3412' },
  });
  assert.equal(brand?.fromName, 'North Office');
  assert.equal(brand?.logoUrl, 'https://cdn.example/north.png');
  const html = brandedMailHtml({ brand, heading: '123456', paragraphs: ['Use this code.'] });
  assert.match(html, /North Academy/);
  assert.match(html, /https:\/\/cdn.example\/north.png/);
  assert.match(html, /#9A3412/);
  assert.equal(accentInk('#9A3412'), '#ffffff');
  assert.equal(accentInk('#F5E6C8'), '#102027');
});
