# Creator Store verification

Checked on 21 Oct 2026 against the Firebase emulators (Auth 9099, Firestore 8080, Storage 9199) and a local Next server. Production Blaze and `FIREBASE_SERVICE_ACCOUNT` were not present. That is recorded as setup needed, not as a successful download.

Branch base is `origin/main` at `487246d` (the full-page AI shell). The diff adds storage rules, the importer, and the single-product form. Existing dashboard access cases in `lib/dashboard-access.test.ts` still pass.

| Check | Result | Evidence |
| --- | --- | --- |
| Public thumbs, images only, max 5 MB | PASS | `tests/storage.rules.test.ts` — anonymous read succeeds, student and support writes fail, a PDF and a 5 MB+ image fail |
| Private paper and mark scheme, never public, separate names, PDF max 50 MB | PASS | Same file — anonymous, student, and admin client reads fail; `combined.pdf` is rejected; a 50 MB+ PDF fails. Emulator import then `GET` of `private/paper.pdf` returned an error status while `thumbs/cover.webp` returned 200 `image/webp` |
| Public preview pages | PASS | Anonymous read of `preview/1.png` succeeds in the rules test |
| Writes only for admin and content_editor | PASS | Rules test. `/dashboard/admin/store/import` is allowed for admin and content_editor and refused for support, finance, and a teacher (`lib/dashboard-access.test.ts`) |
| Dry run reports missing files, bad price, duplicate SKU, year numbers, oversized files | PASS | `lib/store/manifest.test.ts` |
| Two-row ZIP imports as drafts and upserts by SKU | PASS | `e2e/store-import.spec.ts` — `PS-4MA1-H-P1` and `PS-4BI1-F-N1` show `data-product-status="draft"`. A second pass resumes both rows |
| 1200px WebP from a 2000px PNG | PASS | `lib/store/thumb.test.ts` — 2000×1000 PNG becomes a 1200×600 WebP |
| Progress, per-row table, CSV error export, resume | PASS | Importer shows `2/2`. Resume skips finished SKUs (`pendingSkus` unit test and the emulator reload). Export errors is on the desk |
| Never publishes by itself | PASS | Both imported rows and the single-product save stay drafts. Publish is a separate admin button and was not used |
| Single-product upload on the store form, same private/public split | PASS | `/dashboard/store` form saved `PS-4CH1-H-P1` and the page said Draft saved |
| Signed URL needs `FIREBASE_SERVICE_ACCOUNT`, no fake success | PASS | Download check shows the setup-needed message and does not contain `https://`. `lib/store/access.test.ts` rejects a JSON key with no private key |
| Blaze still required to deploy rules | PASS as a note | Standing note on the import desk and in `HANDOVER.md`. This run did not deploy rules to production |
| Regression vs main | PASS for the guard tests that already existed | `lib/dashboard-access.test.ts` 5/5. The hardcoded UI ratchet still fails on studio strings that are already on main (`AI STUDIO` copy). This PR does not add store sentences to that list |

Screenshots:

- `docs/qa/store/import-dry-run-desktop.png`
- `docs/qa/store/import-drafts-desktop.png`
- `docs/qa/store/import-drafts-mobile.png`
- `docs/qa/store/product-form-desktop.png`

GitHub Playwright does not start the emulators, so `e2e/store-import.spec.ts` skips there. Run it locally with `E2E_EMULATOR=1` and `E2E_PREVIEW_PASSWORD`.
