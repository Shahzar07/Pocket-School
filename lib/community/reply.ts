/** A suggested teacher reply when the model is not configured. */

export function suggestReply(input: { question: string; lessonTitle: string }): string {
  const question = input.question.trim().replace(/\s+/g, ' ');
  const title = input.lessonTitle.trim() || 'this lesson';
  return [
    `Thanks for asking about ${title}.`,
    `You wrote: “${question.slice(0, 240)}”.`,
    'Look back at the worked example in the lesson, then try the same steps with your numbers.',
    'If you are still stuck, tell me which line does not make sense and I will unpack just that line.',
  ].join(' ');
}
