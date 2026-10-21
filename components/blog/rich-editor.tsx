'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { Image } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import { StarterKit } from '@tiptap/starter-kit';
import { toast } from 'sonner';
import { htmlToMarkdown, markdownToHtml, wordCount } from '@/lib/blog/richtext';

const button = 'h-11 rounded-full border border-border px-3 text-sm font-semibold text-[var(--studio-text,#203337)]';

function Tool({ editor, label, on, active, disabled }: { editor: Editor | null; label: string; on: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={`${button} ${active ? 'bg-[#3FE0D0] text-[#203337]' : 'bg-[var(--studio-surface,#fff)]'}`}
      aria-pressed={active ? true : undefined}
      disabled={!editor || disabled}
      onClick={on}
    >
      {label}
    </button>
  );
}

export function RichEditor({
  markdown,
  onChange,
  onReady,
}: {
  markdown: string;
  onChange: (markdown: string) => void;
  onReady?: (editor: Editor | null) => void;
}) {
  const emitted = useRef(markdown);
  const [source, setSource] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Image.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: 'Write the essay…' }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: markdownToHtml(markdown),
    editorProps: {
      attributes: {
        'data-blog-editor': '1',
        'aria-label': 'Essay',
        class: 'min-h-56 px-3 py-2 outline-none',
      },
      transformPastedHTML(html) {
        return html
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\s(?:style|class|id)="[^"]*"/gi, '')
          .replace(/<\/?(?:span|font|o:p|meta|link)[^>]*>/gi, '');
      },
    },
    onUpdate: ({ editor: current }) => {
      const next = htmlToMarkdown(current.getHTML());
      emitted.current = next;
      onChange(next);
    },
  });

  useEffect(() => {
    onReady?.(editor);
  }, [editor, onReady]);

  useEffect(() => {
    if (!editor || source) return;
    if (markdown === emitted.current) return;
    editor.commands.setContent(markdownToHtml(markdown), { emitUpdate: false });
    emitted.current = markdown;
  }, [editor, markdown, source]);

  const setLink = () => {
    if (!editor) return;
    const previous = String(editor.getAttributes('link').href || '');
    const href = window.prompt('Link address', previous || 'https://');
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    if (!(href.startsWith('/') || href.startsWith('https://') || href.startsWith('mailto:')) || href.startsWith('//')) {
      toast.error('Use a site path, an https link, or a mailto link.');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  return (
    <div className="space-y-2" data-blog-rich="1">
      <div className="flex flex-wrap gap-2">
        <Tool editor={editor} label="H2" active={editor?.isActive('heading', { level: 2 })} on={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
        <Tool editor={editor} label="H3" active={editor?.isActive('heading', { level: 3 })} on={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} />
        <Tool editor={editor} label="Bold" active={editor?.isActive('bold')} on={() => editor?.chain().focus().toggleBold().run()} />
        <Tool editor={editor} label="Italic" active={editor?.isActive('italic')} on={() => editor?.chain().focus().toggleItalic().run()} />
        <Tool editor={editor} label="Underline" active={editor?.isActive('underline')} on={() => editor?.chain().focus().toggleUnderline().run()} />
        <Tool editor={editor} label="Strike" active={editor?.isActive('strike')} on={() => editor?.chain().focus().toggleStrike().run()} />
        <Tool editor={editor} label="Link" active={editor?.isActive('link')} on={setLink} />
        <Tool editor={editor} label="Bullets" active={editor?.isActive('bulletList')} on={() => editor?.chain().focus().toggleBulletList().run()} />
        <Tool editor={editor} label="Numbers" active={editor?.isActive('orderedList')} on={() => editor?.chain().focus().toggleOrderedList().run()} />
        <Tool editor={editor} label="Quote" active={editor?.isActive('blockquote')} on={() => editor?.chain().focus().toggleBlockquote().run()} />
        <Tool editor={editor} label="Code" active={editor?.isActive('code')} on={() => editor?.chain().focus().toggleCode().run()} />
        <Tool editor={editor} label="Divider" on={() => editor?.chain().focus().setHorizontalRule().run()} />
        <Tool editor={editor} label="Table" on={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
        <Tool editor={editor} label="Undo" disabled={!editor?.can().undo()} on={() => editor?.chain().focus().undo().run()} />
        <Tool editor={editor} label="Redo" disabled={!editor?.can().redo()} on={() => editor?.chain().focus().redo().run()} />
        <button
          type="button"
          className={button}
          aria-pressed={source}
          onClick={() => {
            setSource((current) => {
              if (current && editor) editor.commands.setContent(markdownToHtml(markdown), { emitUpdate: false });
              return !current;
            });
          }}
        >
          {source ? 'Visual' : 'Source'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{wordCount(markdown)} words. Video embeds stay out of the public essay.</p>
      {source ? (
        <textarea
          aria-label="Essay source"
          value={markdown}
          onChange={(event) => onChange(event.target.value)}
          rows={14}
          className="w-full rounded-xl border border-border bg-[var(--studio-surface,#fff)] px-3 py-2 font-mono text-sm text-[var(--studio-text,#203337)]"
        />
      ) : (
        <EditorContent
          editor={editor}
          className="rounded-xl border border-border bg-[var(--studio-surface,#fff)] text-[var(--studio-text,#203337)] [&_.ProseMirror]:min-h-56 [&_blockquote]:border-l-4 [&_blockquote]:border-[#1E6A83] [&_blockquote]:pl-3 [&_h2]:font-heading [&_h2]:text-2xl [&_h3]:font-heading [&_h3]:text-xl [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:px-2 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_ul]:list-disc [&_ul]:pl-5"
        />
      )}
    </div>
  );
}
