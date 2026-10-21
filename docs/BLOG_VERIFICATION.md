# Journal editor verification

Checked on 21 Oct 2026 against the Firebase emulators (Auth 9099, Firestore 8080, Storage 9199) and `next dev` on port 3483. The actor was the emulator super admin `admin.e2e@poketschool.ai`. No production credentials were used.

Playwright: `e2e/blog-editor.spec.ts` — **1 passed**.

Unit tests: `lib/blog/seo.test.ts`, `lib/blog/richtext.test.ts`, `lib/blog/posts.test.ts` — **7 passed**.

| Check | Result | Evidence |
| --- | --- | --- |
| Edit opens the site draft, and the category badge sits inside the hero | PASS | `e2e/blog-editor.spec.ts`; `docs/qa/blog/blog-editor-dark.png` |
| The journal stays on the admin desk. It is not wrapped in the AI tool shell | PASS | `[data-tool-shell="1"]` count is 0 |
| A new essay keeps bold text, an inline image, and a banner after reload | PASS | same spec, after `Published.` |
| The public essay shows the title, the sentence, an image, and JSON-LD | PASS | `docs/qa/blog/blog-public.png` |
| SEO title, meta description, direct answer, takeaways, how-to, and custom fields are on the page | PASS | `docs/qa/blog/blog-seo-dark.png` |
| Suggestions are taken from the essay. A percentage in the essay is not copied into the direct answer | PASS | `lib/blog/seo.test.ts` |
| Stored HTML becomes markdown, and script or iframe markup is dropped | PASS | `lib/blog/richtext.test.ts` |
| A noindex essay is left out of the sitemap JSON-LD | PASS | `lib/blog/seo.test.ts`; `app/sitemap.ts` filters with `allowIndex` |
| Light desktop | PASS | `docs/qa/blog/blog-editor-light.png` |
| Light mobile (390px) | PASS | `docs/qa/blog/blog-editor-light-mobile.png` |
| Dark desktop | PASS | `docs/qa/blog/blog-editor-dark.png` |
| Dark mobile (390px) | PASS | `docs/qa/blog/blog-editor-dark-mobile.png` |
| Essay list | PASS | `docs/qa/blog/blog-list-light.png` |
| Only a super admin can save | PASS in rules and the editor | Firestore `blogPosts` writes require `callerIsSuper()`. The save button stays disabled for every other staff role. This browser run used the super admin only |

Changing the banner description no longer clears a banner that has already uploaded.

Not in this pull request: the curriculum CMS, copyright declaration, lesson translation, mind maps, Action Centre, Pathways, the funnel builder, and student academic results.
