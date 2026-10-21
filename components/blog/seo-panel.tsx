'use client';

import { useEffect, useState } from 'react';
import type { BlogPost } from '@/lib/blog/posts';
import { jsonLdScript } from '@/lib/blog/posts';
import { EMPTY_SEO, jsonLdForPost, seoDescription, seoScore, seoTitle, type BlogCustomField, type BlogHowToStep, type CustomFieldKind } from '@/lib/blog/seo';

const TEMPLATES_KEY = 'poket-blog-field-templates';
const fieldClass = 'mt-1 w-full min-h-11 rounded-xl border border-border bg-[var(--studio-surface,#fff)] px-3 text-[var(--studio-text,#203337)]';

interface Template {
  name: string;
  fields: BlogCustomField[];
}

function readTemplates(): Template[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TEMPLATES_KEY) || '[]') as Template[];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.name === 'string' && Array.isArray(item.fields)) : [];
  } catch {
    return [];
  }
}

export function SeoPanel({
  post,
  onChange,
  onSuggest,
  suggesting,
}: {
  post: BlogPost;
  onChange: (next: Partial<BlogPost>) => void;
  onSuggest: () => void;
  suggesting: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState('');
  useEffect(() => { setTemplates(readTemplates()); }, []);
  const score = seoScore(post);
  const title = seoTitle(post);
  const description = seoDescription(post);
  const fields = post.customFields || [];
  const takeaways = post.takeaways?.length ? post.takeaways : [''];
  const steps = post.howto?.length ? post.howto : [{ name: '', text: '' }];

  const saveTemplate = () => {
    const name = templateName.trim();
    if (!name || fields.length === 0) return;
    const next = [...templates.filter((item) => item.name !== name), { name, fields }];
    window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
    setTemplates(next);
    setTemplateName('');
  };

  return (
    <aside className="rounded-3xl border border-border bg-card p-4" data-blog-seo="1">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold">SEO and answers</h2>
        <button type="button" className="h-11 rounded-full border px-3 text-sm font-semibold" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Checklist {score.score}%</p>
      {open ? (
        <div className="mt-3 space-y-3">
          <ul className="space-y-1 text-xs">
            {score.checks.map((item) => (
              <li key={item.id} className={item.ok ? 'text-[#1E6A83]' : 'text-muted-foreground'}>{item.ok ? 'Ready' : 'Missing'} · {item.label}</li>
            ))}
          </ul>
          <button type="button" className="h-11 rounded-full bg-[#3FE0D0] px-4 text-sm font-bold text-[#203337] disabled:opacity-40" disabled={suggesting} onClick={onSuggest}>
            {suggesting ? 'Suggesting…' : 'Suggest from the essay'}
          </button>
          <label className="block text-sm font-semibold">SEO title
            <input value={post.seoTitle || ''} maxLength={70} onChange={(event) => onChange({ seoTitle: event.target.value })} className={fieldClass} />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">{title.length} / 60</span>
          </label>
          <label className="block text-sm font-semibold">Meta description
            <textarea value={post.seoDescription || ''} maxLength={180} rows={3} onChange={(event) => onChange({ seoDescription: event.target.value })} className={fieldClass} />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">{description.length} / 160</span>
          </label>
          <div className="rounded-xl bg-white p-3 text-[#203337]" data-blog-snippet="1">
            <p className="text-sm text-[#1E6A83]">{title || 'Essay title'}</p>
            <p className="text-xs text-[#203337]/70">poketschool.ai/blog/{post.slug || 'slug'}</p>
            <p className="mt-1 text-xs leading-5">{description || 'The description readers see in search.'}</p>
          </div>
          <label className="block text-sm font-semibold">Canonical
            <input value={post.canonical || ''} onChange={(event) => onChange({ canonical: event.target.value })} placeholder="/blog/your-essay" className={fieldClass} />
          </label>
          <label className="block text-sm font-semibold">Focus keyword
            <input value={post.focusKeyword || ''} onChange={(event) => onChange({ focusKeyword: event.target.value })} className={fieldClass} />
          </label>
          <label className="block text-sm font-semibold">Secondary keywords
            <input value={(post.secondaryKeywords || []).join(', ')} onChange={(event) => onChange({ secondaryKeywords: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} className={fieldClass} />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={post.robotsIndex !== false} onChange={(event) => onChange({ robotsIndex: event.target.checked })} />
            Allow indexing
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={post.robotsFollow !== false} onChange={(event) => onChange({ robotsFollow: event.target.checked })} />
            Allow following links
          </label>
          <label className="block text-sm font-semibold">Social title
            <input value={post.ogTitle || ''} onChange={(event) => onChange({ ogTitle: event.target.value })} className={fieldClass} />
          </label>
          <label className="block text-sm font-semibold">Social description
            <textarea value={post.ogDescription || ''} rows={2} onChange={(event) => onChange({ ogDescription: event.target.value })} className={fieldClass} />
          </label>
          <label className="block text-sm font-semibold">Card
            <select value={post.twitterCard || 'summary_large_image'} onChange={(event) => onChange({ twitterCard: event.target.value as BlogPost['twitterCard'] })} className={fieldClass}>
              <option value="summary_large_image">Large image</option>
              <option value="summary">Summary</option>
            </select>
          </label>
          <div className="rounded-xl border border-border p-3" data-blog-social="1">
            <p className="text-sm font-semibold">{post.ogTitle || title || 'Social title'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{post.ogDescription || description}</p>
          </div>
          <label className="block text-sm font-semibold">Direct answer
            <textarea value={post.tldr || ''} rows={3} onChange={(event) => onChange({ tldr: event.target.value })} className={fieldClass} />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Key takeaways</legend>
            {takeaways.map((item, index) => (
              <input key={index} aria-label={`Takeaway ${index + 1}`} value={item} onChange={(event) => onChange({ takeaways: takeaways.map((row, rowIndex) => rowIndex === index ? event.target.value : row) })} className={fieldClass} />
            ))}
            {takeaways.length < 8 ? <button type="button" className="h-11 text-sm font-bold text-[#1E6A83]" onClick={() => onChange({ takeaways: [...takeaways, ''] })}>Add a takeaway</button> : null}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">How-to steps</legend>
            {steps.map((step, index) => (
              <div key={index} className="grid gap-2">
                <input aria-label={`Step ${index + 1} name`} value={step.name} onChange={(event) => onChange({ howto: steps.map((row, rowIndex) => rowIndex === index ? { ...row, name: event.target.value } : row) })} placeholder="Step name" className={fieldClass} />
                <input aria-label={`Step ${index + 1} text`} value={step.text} onChange={(event) => onChange({ howto: steps.map((row, rowIndex) => rowIndex === index ? { ...row, text: event.target.value } : row) })} placeholder="What to do" className={fieldClass} />
              </div>
            ))}
            {steps.length < 12 ? (
              <button type="button" className="h-11 text-sm font-bold text-[#1E6A83]" onClick={() => onChange({ howto: [...steps, { name: '', text: '' } satisfies BlogHowToStep] })}>Add a step</button>
            ) : null}
          </fieldset>
          <label className="block text-sm font-semibold">Questions this essay answers
            <input value={(post.targetQuestions || []).join(', ')} onChange={(event) => onChange({ targetQuestions: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} className={fieldClass} />
          </label>
          <label className="block text-sm font-semibold">Entities
            <input value={(post.entities || []).join(', ')} onChange={(event) => onChange({ entities: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} className={fieldClass} />
          </label>
          <label className="block text-sm font-semibold">Reviewer
            <input value={post.reviewer || ''} onChange={(event) => onChange({ reviewer: event.target.value })} className={fieldClass} />
          </label>
          <label className="block text-sm font-semibold">Last reviewed
            <input type="date" value={post.reviewedAt ? new Date(post.reviewedAt).toISOString().slice(0, 10) : ''} onChange={(event) => onChange({ reviewedAt: event.target.value ? new Date(`${event.target.value}T00:00:00`).getTime() : null })} className={`${fieldClass} [color-scheme:inherit]`} />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Custom fields</legend>
            {fields.map((item, index) => (
              <div key={`${item.key}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_8rem_1fr]">
                <input aria-label={`Field ${index + 1} key`} value={item.key} onChange={(event) => onChange({ customFields: fields.map((row, rowIndex) => rowIndex === index ? { ...row, key: event.target.value } : row) })} placeholder="key" className={fieldClass} />
                <select aria-label={`Field ${index + 1} type`} value={item.kind} onChange={(event) => onChange({ customFields: fields.map((row, rowIndex) => rowIndex === index ? { ...row, kind: event.target.value as CustomFieldKind } : row) })} className={fieldClass}>
                  <option value="text">Text</option>
                  <option value="url">URL</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="toggle">Toggle</option>
                </select>
                <input aria-label={`Field ${index + 1} value`} value={item.value} onChange={(event) => onChange({ customFields: fields.map((row, rowIndex) => rowIndex === index ? { ...row, value: event.target.value } : row) })} className={fieldClass} />
              </div>
            ))}
            <button type="button" className="h-11 text-sm font-bold text-[#1E6A83]" onClick={() => onChange({ customFields: [...fields, { key: '', kind: 'text', value: '' }] })}>Add a field</button>
            <div className="flex flex-wrap gap-2">
              <input aria-label="Template name" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" className={fieldClass} />
              <button type="button" className="h-11 rounded-full border px-3 text-sm font-semibold" onClick={saveTemplate}>Save template</button>
            </div>
            {templates.length > 0 ? (
              <label className="block text-sm font-semibold">Apply a template
                <select className={fieldClass} defaultValue="" onChange={(event) => {
                  const chosen = templates.find((item) => item.name === event.target.value);
                  if (chosen) onChange({ customFields: chosen.fields.map((field) => ({ ...field })) });
                }}>
                  <option value="">Choose</option>
                  {templates.map((item) => <option key={item.name}>{item.name}</option>)}
                </select>
              </label>
            ) : null}
          </fieldset>
          <pre className="max-h-40 overflow-auto rounded-xl bg-[#203337] p-3 text-xs text-white">{jsonLdForPost({ ...EMPTY_SEO, ...post }).map((block) => jsonLdScript(block)).join('\n')}</pre>
        </div>
      ) : null}
    </aside>
  );
}
