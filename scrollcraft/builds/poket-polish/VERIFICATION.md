# Homepage polish verification

## Fixes
- Clipped the hero so its phone cannot paint over the pathway navigation or feature section. Added desktop CTA clearance for the phone's full motion range.
- Made pathway navigation scroll horizontally and keep every link keyboard-reachable on phones.
- Reserved space below the sticky header for section anchors; initialized header state after scroll restoration.
- Added Escape dismissal/focus restoration to the mobile navigation, closed it when crossing to desktop, and enlarged mobile targets.
- Separated tablet CTA copy from its phone. Reflowed the closing phone after the copy on narrow screens, so neither CTA link is covered.
- Scoped a mobile line-break rule to the CTA description. It previously flattened the text inside the illustrated phone.
- Moved bright clouds out of the tablet CTA reading area and strengthened muted body text slightly.

## Motion
- Natural-scroll hero depth: stable copy, independently moving clouds, phone, and note cards, anchored foreground mist.
- One-time short card entrances, paired comparison entrances, and a progress chart that draws once. Existing illustrative values do not change.
- Small button-arrow and card hover responses on fine-pointer devices only.
- No scroll hijacking, pinning, extra empty sections, animation dependency, continuous loop, or pointer capture.
- Reduced-motion preference disables motion, including when changed while the page is open. Mobile gets less entrance travel and no parallax. Content stays visible without JavaScript. Keyboard focus cancels any entrance affecting the focused element.

## Verification
- Production build passed, generating 71 static pages.
- TypeScript check and git whitespace check passed.
- Chromium viewport checks: 1280×900 desktop, 768×1024 tablet, 390×844 phone, 360×640 compact phone, and 1280×900 with reduced motion.
- Captured opening, mid-hero, hero exit, feature/comparison/progress/pricing sections, closing CTA, and full-page frames for each viewport.
- Asserted no document horizontal overflow, hero clipping, pathway hit testing, parallax progress, monthly/yearly pricing ($19 monthly or $14.25/month and $171/year), mobile Escape/focus restoration, anchor offsets, keyboard scrolling to the final pathway, CTA/phone separation, and live reduced-motion changes.
- Separate check verifies chart transform changes during playback, animation does not repeat on revisit, and headline/primary CTA render with JavaScript disabled.
- No page JavaScript errors in the five-viewport run.
- Final visual review: approved composition retained; phone boundary and narrow CTA overlap corrected; tablet CTA cloud contrast improved; chart resolves to the original values. Intended calm → discovery → confidence → invitation sequence retained. No new assets generated.

## Evidence and reproduction
Visual screenshots and the contact sheet were inspected locally. The image upload was blocked by automatic approval review, so images are not included in the GitHub changes. Machine-readable results are in `evidence/results.json` and `evidence/motion-results.json`.

From the repository root, after `npm run build`, with Playwright available:

```sh
node scrollcraft/builds/poket-polish/verify-home.cjs
node scrollcraft/builds/poket-polish/verify-motion.cjs
```

Optional environment variables: `PLAYWRIGHT_MODULE` (module path), `CHROME_PATH` (browser executable), and `HOME_QA_OUTPUT` (output folder). Native pointer capture/lock are disabled in scripted contexts. The visual run uses the production Next build locally.

The initial browser failures were environmental (missing browser/font configuration); the completed runs supersede those failed attempts. Existing ESLint configuration ignores TSX, so it is not counted as passing validation. Real iOS/Android hardware, remote production deployment, and authenticated backend/payment transactions are not covered by these layout checks.

## Follow-up: responsive and animation defects (2026-09-20)

Reproduced the previous revision locally before changing it. At 320px the hero phone overlapped the copy/actions by approximately 49px. At 641px the desktop navigation wrapped its sign-in label. Tablet widths retained narrow three-column cards. The header also changed height at its scroll threshold, while staggered animations used `fill: none`, exposing the final frame during their delay.

Changes:
- The hero illustration participates in normal layout, with space reserved for its parallax range. Wrapped copy and buttons now increase section height instead of colliding with the phone.
- The closing illustration has its own grid column, then follows the copy below 801px. Its label has a readable solid background, and bright clouds stay away from the copy.
- The header keeps a constant height when its scroll state changes. Mobile navigation starts at 800px, with a matching resize listener. Navigation labels do not wrap.
- Feature cards use two columns on tablets and one on compact phones. Comparison, progress, and pricing sections reflow before their columns become cramped. Annual prices and buttons wrap without overflowing.
- Staggered reveals hold their first frame during delays and start just before entering the viewport. Already-visible content stays static on hydration; completed reveals do not replay after motion preferences change. Tab visibility/page restoration settle active animations.

Verification of this revision:
- `npm run build`, `npx tsc --noEmit`, and `git diff --check` passed.
- `verify-responsive.cjs` checks 320, 360, 390, 640, 641, 768, 800, 801, 900, 901, 1024, 1280, and 1536px widths. Checks include document overflow, header bounds and constant height, hero/closing phone clearance, section anchors, mobile Escape handling, and annual pricing.
- The same script checks the chart's staggered frames, cancellation of in-flight animations when reduced motion is enabled, no replay after changing preferences or revisiting, deep-link loading, and closing mobile navigation across the desktop breakpoint.
- `verify-motion.cjs` checks chart progression, one-time playback, and no-JavaScript rendering. Its readiness check now waits for the motion hook before simulating a later scroll; an initial deep-link view intentionally stays static.
- No page JavaScript errors in the responsive run. Full-page and closing-section screenshots were reviewed at desktop, tablet, and compact/mobile widths.
- Results: `evidence/responsive-results.json` and `evidence/motion-results.json`. Screenshots remain local QA artifacts. Browser coverage is desktop Chromium with emulated viewport sizes; real-device Safari and Android rendering are not covered.

Reproduce the new regression run after building:

```sh
node scrollcraft/builds/poket-polish/verify-responsive.cjs
```

Use the same optional `PLAYWRIGHT_MODULE`, `CHROME_PATH`, and `HOME_QA_OUTPUT` variables documented above.
