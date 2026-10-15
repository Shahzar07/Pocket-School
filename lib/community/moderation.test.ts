import { describe, expect, it } from 'vitest';
import { mergeModeration, moderateText, parseAiModeration } from './moderation';

describe('moderateText', () => {
  it('allows ordinary school posts', () => {
    expect(moderateText('I finally understood simultaneous equations.').decision).toBe('allow');
  });

  it('blocks self-harm and sexual content involving minors', () => {
    expect(moderateText('you should kill yourself').reasons).toContain('self_harm');
    expect(moderateText('nude pics of a child').decision).toBe('block');
  });

  it('holds harassment and off-platform contact', () => {
    expect(moderateText('you are so stupid').decision).toBe('hold');
    expect(moderateText('add me on whatsapp').reasons).toContain('off_platform');
    expect(moderateText('email me at ada@school.edu').reasons).toContain('contact_info');
  });
});

describe('mergeModeration', () => {
  it('keeps a local block even if the model says allow', () => {
    const merged = mergeModeration(
      { decision: 'block', reasons: ['self_harm'] },
      { decision: 'allow', reasons: [] },
    );
    expect(merged.decision).toBe('block');
  });

  it('holds an allowed post when the model is unsure', () => {
    const merged = mergeModeration(
      moderateText('Can someone check my essay?'),
      parseAiModeration('{"decision":"hold","reasons":["personal_detail"]}'),
    );
    expect(merged.decision).toBe('hold');
    expect(merged.reasons).toContain('personal_detail');
  });

  it('ignores model output that is not JSON', () => {
    expect(parseAiModeration('sure, looks fine')).toBeNull();
  });
});
