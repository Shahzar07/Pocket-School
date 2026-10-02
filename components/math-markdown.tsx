'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * Models write maths in two dialects. remark-math only understands dollar
 * delimiters, so `\( x^2 \)` and `\[ … \]` — which Gemini and GPT both emit
 * regularly — used to reach the student as raw backslashes. Convert them,
 * leaving fenced and inline code untouched.
 */
export function normaliseMath(text: string): string {
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `\n$$${m.trim()}$$\n`)
            .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => `$${m.trim()}$`),
    )
    .join('');
}

export function MathMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
      {normaliseMath(children ?? '')}
    </ReactMarkdown>
  );
}
