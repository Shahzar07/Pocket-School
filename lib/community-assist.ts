/** Prompt ET AI can summarise. The person still posts the reply. */
export function channelSummaryPrompt(bodies: string[]): string {
  const lines = bodies.map((body) => body.trim()).filter(Boolean).slice(-12);
  if (!lines.length) return '';
  return [
    'Summarise this class channel in three short sentences.',
    'Then suggest one reply a teacher could post. Do not post it yourself.',
    lines.join('\n'),
  ].join('\n');
}
