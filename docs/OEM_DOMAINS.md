# Academy domains

Each institution is an academy at `{slug}.poketschool.ai`. Until the wildcard DNS for `poketschool.ai` answers, the same academy is served at `/a/{slug}` on the apex host. Branding, catalogue, and login follow the host or that path. A renamed slug redirects to the current one, and the old slug stays reserved.

Custom domains (for example `learn.school.example`) are available on the enterprise and OEM plans. Starter and team academies keep the Poket School subdomain.

## What Harry does for `*.poketschool.ai`

1. In the DNS host for `poketschool.ai`, add the apex records Vercel shows for the project (usually an A record to `76.76.21.21`, or the ALIAS Vercel prints).
2. Add a wildcard record:
   - Type: `CNAME` (or `ALIAS` if the DNS host cannot CNAME a wildcard)
   - Host: `*`
   - Target: `cname.vercel-dns.com`
3. In the Vercel project that serves Poket School, open **Settings → Domains** and add:
   - `poketschool.ai`
   - `www.poketschool.ai`
   - `*.poketschool.ai`
4. Wait until Vercel marks each name as valid. The wildcard certificate is issued by Vercel. Do not upload a certificate by hand.
5. Reserved labels (`www`, `api`, `admin`, `login`, `courses`, and the rest of the list in `lib/tenant-host.ts`) never become academies.

After this, `north.poketschool.ai` resolves with no further DNS change per academy. Creating the academy and saving the slug is enough.

## Path fallback

While step 2 is not live, open `https://poketschool.ai/a/north` (or the deployment host with the same path). The app rewrites that URL onto the normal pages and keeps `/a/north` in the address bar, so the main site is not branded by the visit. Links inside that visit stay under `/a/north`.

## Custom domain and automatic SSL

Academy settings show the DNS record:

- Type `CNAME`
- Host: the left-most label (`learn` for `learn.school.example`)
- Target: `cname.vercel-dns.com`
- An apex name (`school.example`) needs an ALIAS or ANAME to the same target. A `www` name can be a CNAME.

Set these on the server when Poket School should attach the hostname and let Vercel issue SSL:

- `VERCEL_TOKEN` — a token that can edit project domains
- `VERCEL_PROJECT_ID` — the project id
- `VERCEL_TEAM_ID` — only when the project is on a team

**Check DNS and SSL** in the academy settings calls `POST /v10/projects/{projectId}/domains`. Vercel verifies the record and attaches the certificate. The screen stores `manual`, `pending`, `active`, or `error`.

If `VERCEL_TOKEN` or `VERCEL_PROJECT_ID` is missing, nothing is sent to Vercel. The status stays `manual` and the CNAME instructions remain. Sign-in and the academy keep working.

Do not put the token in the client, in Firestore, or in a screenshot.
