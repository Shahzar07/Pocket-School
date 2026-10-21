# Creator Store import

Admins and content editors import paid papers at `/dashboard/admin/store/import`. The same private and public split is on the Creator Store form at `/dashboard/store` for one product at a time.

Nothing in this flow publishes a product. A saved row is a draft until an admin reviews it and publishes it.

## ZIP layout

The ZIP root contains `manifest.csv` (UTF-8) and one folder per SKU. File columns are paths relative to that root.

```csv
sku,title,subject,level,exam_board,spec_code,type,price_usd,price_myr,access,description,tags,paper_pdf,markscheme_pdf,thumbnail,preview_images,status
PS-4MA1-H-P1,Mathematics Paper 1,Mathematics,Higher,Pearson Edexcel,4MA1,paper,9.00,39.00,paid,Higher paper and a separate mark scheme.,maths|paper,PS-4MA1-H-P1/PS-4MA1-H-P1_PAPER.pdf,PS-4MA1-H-P1/PS-4MA1-H-P1_MARK_SCHEME.pdf,PS-4MA1-H-P1/thumb.png,PS-4MA1-H-P1/preview-1.png|PS-4MA1-H-P1/preview-2.png,draft
PS-4BI1-F-N1,Biology notes,Biology,Foundation,Pearson Edexcel,4BI1,notes,0.00,0.00,free,Foundation notes with a separate mark scheme.,biology|notes,PS-4BI1-F-N1/PS-4BI1-F-N1_PAPER.pdf,PS-4BI1-F-N1/PS-4BI1-F-N1_MARK_SCHEME.pdf,PS-4BI1-F-N1/thumb.png,PS-4BI1-F-N1/preview-1.png,
```

- `access` is `paid` or `free`. A paid row needs a price above zero in USD or MYR, and both the paper and the mark scheme.
- `tags` and `preview_images` are separated by `|`.
- `level` is a level name such as Higher or Foundation. `Year 10`, `2024`, and `10` are rejected.
- `status` defaults to draft. Any other value is stored as draft.
- The thumbnail is a PNG. The importer writes a 1200px WebP (the long side is at most 1200, and a smaller PNG is not enlarged).
- Paper and mark scheme must be different PDFs. They are stored as separate objects.

## Where files go

| ZIP column | Storage path | Who can read it |
| --- | --- | --- |
| thumbnail | `store/products/{productId}/thumbs/cover.webp` | public, images, 5 MB |
| preview_images | `store/products/{productId}/preview/{n}.webp` | public, images, 5 MB |
| paper_pdf | `store/products/{productId}/private/paper.pdf` | nobody via the client |
| markscheme_pdf | `store/products/{productId}/private/markscheme.pdf` | nobody via the client |

Only an `adminRole` of `super_admin`, `admin`, or `content_editor` can write those paths. Support, finance, students, and anonymous clients cannot.

Downloads of the private PDFs go through `POST /api/store/download`. The route allows an admin or content editor, a published free product, a `store_purchases/{uid}_{productId}` row, or `alloc:store:{productId}` / `alloc:resource:{productId}`. It then asks the Admin SDK for a signed URL that lasts about 10 minutes and writes `store_download_logs`.

## Dry run, progress, resume

1. Choose the ZIP. Dry run checks every row before any upload: missing files, bad prices, duplicate SKUs in the file, year numbers, and oversized files (images 5 MB, PDFs 50 MB).
2. Import drafts uploads one valid row at a time and shows `saved/total`.
3. Progress is kept on `store_import_jobs/{jobId}/rows/{sku}` and in this browser under `poket-store-import`. Resume uses the same ZIP and skips SKUs already marked done.
4. Export errors downloads a CSV of the rows that failed the dry run.

An existing SKU is updated and put back to draft so the new files are reviewed again.

## Production setup

Two things are still required before this works for real students. The app does not pretend they are done.

- The Firebase project needs the **Blaze** plan before `storage.rules` can be deployed. See `HANDOVER.md`.
- Vercel needs **`FIREBASE_SERVICE_ACCOUNT`** (a service-account JSON with a private key) before a download can be signed. Without it the download route returns HTTP 503 and `SETUP_NEEDED`. It does not return a fake URL.

The Firestore emulator is enough for a local import. It is not a signing key.

## Checks

```bash
npx tsx --test lib/store/*.test.ts lib/dashboard-access.test.ts
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 npx tsx --test tests/storage.rules.test.ts
```

The emulator walk is `e2e/store-import.spec.ts`. It skips unless `E2E_EMULATOR=1` and `E2E_PREVIEW_PASSWORD` are set.
