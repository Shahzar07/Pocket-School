# Poket redesign checkpoint

## User's goal
Publish the approved sky-blue Poket homepage in this existing repository and carry its visual language through the entire app. Preserve every existing feature, route, authentication flow, Stripe checkout, data integration, school branding and language selection. Use Next.js, Tailwind and GSAP, and apply Unslop for consistency. The user explicitly authorized publication and connected GitHub as Shahzar07.

## Branch and base
- Working branch: `design/poket-reference-system`
- Base: latest production `main` at `5c2f264d9d9c0d6d661f57b489fdd672c0f3b1b7` (1 November 2026).
- Original repo: https://github.com/Shahzar07/Pocket-School
- Production: https://poketschool.ai and https://pocket-school-ochre.vercel.app
- Vercel project: `pocket-school`, ID `prj_u8pzNF0o2YRep1yyfN73zY1OgLK7`, team `team_WC7NypskifzL5Qj3ghlLAQk6`, user account shahzarrayyan123@gmail.com.
- This checkpoint has NOT been merged into main or published to production. Finish checks first.

## Implemented
- Approved homepage in `components/poket-home/Home.tsx`, wired through `components/site-home.tsx`. Academy-specific homes remain intact.
- Scoped homepage CSS in `app/poket-home.css`; app theme and shared styling in `app/poket-system.css`, both imported by `app/globals.css`.
- Exact approved raster wordmark/pictorial assets in `public/images`, optimized into WebP. `components/poket-wordmark.tsx` provides both full logo and exact cropped mark. `app/icon.png` uses the approved mark.
- Plus Jakarta Sans throughout the UI. Root layout keeps Arabic, Hebrew and Tamil font support and aliases the previous DM display families to Jakarta. Reading/accessibility and institution font choices remain available.
- Shared navigation, footer, dashboard frame, buttons/cards, standalone module/Studio chrome, login/signup layouts refreshed. Over 260 existing UI files received presentation-only palette changes, without changing API handlers or database/security rules.
- Learner section: accessible Students / Parents / Teachers tabs, matching image/content/actions, roving keyboard focus, scoped GSAP transitions.
- Dynamic story carousel: previous/next/dots/keyboard/swipe. It explicitly labels quotes as illustrative learner perspectives, NOT real customer testimonials. No permissioned real reviews were supplied.
- Homepage pricing uses the existing `usePricing`, real plan IDs and actual configured monthly/annual amounts, including null prices. Never replace this with the old demo's hardcoded $49/$79 and computed annual prices. Annual amounts may be explicitly configured (e.g. IGCSE $708/year).
- Pricing page keeps its original checkout handlers and currency support. Homepage plan links carry billing choice and plan anchors to the real pricing page.
- Homepage English copy centralized in `lib/i18n/poket-home.ts`, registered in the existing catalog; reviewed existing localized hero/audience copy is reused. New copy has English fallback where no reviewed translation exists.
- Scoped GSAP cleanup and reduced-motion handling.
- Minimal pre-existing TS fixes: catalog output type reflects merged namespaces, timetable translation parameter widened to string, readonly pathway boards, premium test Set typing; corrected Studio `.map(renderTool)` passing an index as the boolean nested argument.

## Verification completed
- A full production build passed using `NODE_OPTIONS=--max-old-space-size=6144 npm run build`. Default 2GB Node heap OOMs on this large app. Existing Next output remains standalone; no static-export conversion.
- The passing build was before the final localization/asset/deep-link/footer cleanups. RUN A FINAL BUILD on this checkpoint before merging/deploying.
- Focused repository regression suite: 73/73 passed. Subsequent targeted contrast tests: 6/6 passed.
- `node --import tsx scripts/check-home-interactions.mjs` passed for audience tabs/keyboard, carousel controls/swipe/disclosure, live plan IDs, null prices, configured annual totals, local actions. Last deep-link change was tested.
- Final `npm run typecheck` was running at handoff; inspect/re-run it. Earlier baseline had pre-existing errors, and small type-only fixes were applied. No errors had appeared in the latest log yet.
- Broad pure-library suite: 1,025 tests, 1,020 passed initially. One design assertion was subsequently corrected for the new no-gradient-text design. Remaining failures were reproduced on the clean base: brand-ET copy test, level-name copy test, hardcoded UI baseline, and an admin batch test needing server-only test setup. Do not erase unrelated baseline failures or falsely report all tests passing.
- The redesigned branch introduced ZERO additional hardcoded UI strings compared with clean main (`hardcodedUiStrings`).
- All 358 page routes and all 210 API routes remain present. No API/server/database/middleware/security-rule changes were made.
- Full signed-in browser E2E verification has NOT been completed. Earlier browser preview automation was rejected by URL policy; do not bypass that rejection via another browser tool. Component DOM checks used jsdom, not a browser.

## Next work
1. Read this file and the diff on the branch. Check remote main for any newer changes and integrate safely without overwriting them.
2. Finish any remaining app-wide consistency polish. Avoid broad rewrites of real functional screens or replacing live features with the homepage's example dashboard.
3. Run final typecheck, production build with enough heap, focused regression tests and homepage DOM tests. Review assets/links/responsiveness/accessibility as permitted.
4. Create/update a reviewable PR against main, inspect the Vercel preview and checks, then merge/publish using the user's existing explicit authorization. Verify the production deployment matches the merged commit and the correct Vercel project/team. Preserve environment variables and integrations.
5. Report the actual production link and remaining verification limits accurately.

## Notes
The original approved standalone demo was at https://poket-learning.shahzz07.chatgpt.site. The migration source components came from that approved implementation, not an invented new layout. Its three-card static pricing was deliberately replaced with real repository configuration.

Unslop by Damir Sokolovsky (https://heydamir.design/unslop), CC BY 4.0, was applied to this visual pass. Preserve this credit in adaptations.
