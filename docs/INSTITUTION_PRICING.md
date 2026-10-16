# Institution volume pricing

Sources for every figure below are the four files supplied with this change. They are Pearson’s 2023 international catalogues and the matching UK price lists. They are not copied into the repository.

| File | What it is |
| --- | --- |
| Primary price list (xlsx) | Navigation sheet, row 2: “Pearson International Schools - UK Primary Resources Price List 2023”. Prices are on sheet `MASTER`. Columns used: `NewPrice2023` (GBP), `USD $`, `EUR €`. The `VAT` column is empty on the rows cited here. |
| Secondary price list (xlsx) | Navigation sheet, row 2: “Pearson International Schools - UK Secondary Resources Price List 2023”. Prices are on sheet `MASTER`. Columns used: `Price` (GBP), `USD $`, `EUR €`. The `VAT` column is empty on the rows cited here. |
| International Primary Catalogue 2023 (pdf) | 32 pages. Product descriptions. It tells schools that a subscription is priced for school size and points them at a downloadable price list. It does not print the tier amounts. |
| International Secondary Catalogue 2023 (pdf) | 17 pages. Same pattern. |

OxfordAQA is not in these four files. The secondary catalogue, PDF page 4, names Oxford only as one of the universities that recognise Pearson qualifications. It does not publish an Oxford or OxfordAQA fee. No MYR column appears in either workbook. This note does not convert GBP or USD into MYR.

## How Pearson prices a school

Both catalogues describe an annual subscription sized for the school, plus print or digital pupil books. They do not publish a per-pupil monthly rate.

- Primary catalogue, PDF page 24, Abacus: “3 x annual Online subscriptions – Key Stage 1 (Rec – Year 2), Lower Key Stage 2 (Year 3–4) and Upper Key Stage 2 (Year 5–6) (pricing to suit your school size).”
- Secondary catalogue, PDF page 8, Maths Progress International and Exploring Science International: “1 x ActiveLearn annual subscription (pricing to suit your school size).” The maths summary also offers digital student books “as a whole school annual subscription or individual subscription.”

The price lists then sell each digital service as one annual fee for a size label. Most labels do not say how many pupils they cover.

### Primary: Category A–E, pupil count not stated

Abacus, sheet `MASTER`, one key stage (the KS1, Lower KS2, and Upper KS2 rows are the same amounts). Item type `ALP Subscription`.

| Category | GBP `NewPrice2023` | USD | EUR |
| --- | ---: | ---: | ---: |
| A | 185 | 249.99 | 210.99 |
| B | 370 | 499.99 | 420.99 |
| C | 560 | 755.99 | 635.99 |
| D | 740 | 998.99 | 840.99 |
| E | 930 | 1255.99 | 1055.99 |

The same five labels are used for Bug Club, Science Bug International, Wordsmith, and Bug Club Phonics. The amounts differ by series. Example, Bug Club Phonics ActiveLearn Primary Subscription, sheet `MASTER`: Category A GBP 131 / USD 176.99, Category E GBP 660 / USD 890.99. These files never define Category A–E as a pupil range, so those USD figures are not assigned to a Poket seat band.

### Lower secondary: Small through Super, pupil count not stated

Maths Progress International ActiveLearn Digital Subscription, secondary sheet `MASTER`.

| School label | GBP `Price` | USD | EUR |
| --- | ---: | ---: | ---: |
| Small School | 690 | 931.99 | 783.99 |
| Medium School | 920 | 1241.99 | 1044.99 |
| Large School | 1150 | 1552.99 | 1305.99 |
| Extra Large School | 1370 | 1849.99 | 1555.99 |
| Super School | 1670 | 2254.99 | 1896.99 |

Pearson Edexcel International GCSE (9–1) Mathematics A Digital Subscription, same sheet, uses Small / Medium / Large / Extra Large / Super with USD 607.99, 850.99, 985.99, 1174.99, and 1403.99. The sheet does not say how many students each of those five words means.

### The only rows that state a learner count

Edexcel AS and A level Mathematics and Further Mathematics ActiveLearn Digital Service Subscription, secondary sheet `MASTER`.

| Row title | GBP `Price` | USD | EUR |
| --- | ---: | ---: | ---: |
| (1-10 users) | 271 | 365.99 | 307.99 |
| , &lt;100 learners | 430 | 580.99 | 488.99 |
| (100+ users) | 680 | 917.99 | 772.99 |

This is one subject’s annual school subscription. It is not a per-student price, and the sheet has no monthly column. Dividing 365.99 by 10, or by 12, would invent a unit rate. The defaults do not do that.

A second family on the same sheet is a single-user or “up to N users” homework licence, still a flat fee for the cap. EDX AS/A level Biology 2015 Homework, Practice and Support: single user licence GBP 13.6 / USD 18.99; up to 50 user licence GBP 193 / USD 260.99; up to 150 user licence GBP 335 / USD 452.99. Chemistry and Physics have their own rows. 50 × 18.99 is 949.50, which is not the published “up to 50” price, so 18.99 is a one-user product, not a per-student rate inside a band.

## Comparison

| | Pearson ActiveLearn (these files) | OxfordAQA / Oxford |
| --- | --- | --- |
| What is sold | Annual digital subscription per series or key stage, plus optional print pupil books | Not in these four files |
| How size is charged | One fee for a label: Category A–E, or Small / Medium / Large / Extra Large / Super. Three A level maths rows state 1–10 users, under 100 learners, and 100+ users | Not in these four files |
| Per pupil | Not published. Pupil books on the secondary list are a unit print price, for example ¡Viva! 1 Segunda Edición Pupil Book, GBP 21 / USD 28.99, item type `Student Book` | Not in these four files |
| Per month | Not published | Not in these four files |
| Currency | GBP, USD, and EUR columns. VAT column blank on the cited rows | Not in these four files |
| Add-ons such as live AI or a reading library | Not in these files. Assessment and homework packs are separate ISBNs with their own flat fees | Not in these four files |

## Suggested Poket defaults

The seat bands follow the only published user cuts. The requested 51–100 and 101–300 edges are moved by one student because the list changes price at 100 users. A single price for 51–100 would have to invent either the under-100 fee for the 100th student or the 100+ fee for students 51–99.

Currency is USD, taken from the USD column, not converted. Per student per month, per student per year, and the monthly platform fee are 0 because the sheet does not publish them. The annual figure is the optional flat platform fee. Primary & Lower Secondary and Professional & Degrees stay at 0: the primary and lower-secondary ladders above have no pupil counts, and neither file prices a professional or degree plan. ET AI Live and Poket Reads stay at 0: the files do not price them. MYR is not suggested, because it is not in the files.

A super admin can edit, add, and delete tiers, and can type any of those zero amounts.

| Tier | Students | Plan | Per student / month | Per student / year | Platform fee / month | Platform fee / year (USD) | Source row |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| 0–10 | 0–10 | IGCSE & A-Level | 0 | 0 | 0 | 365.99 | (1-10 users) |
| 11–50 | 11–50 | IGCSE & A-Level | 0 | 0 | 0 | 580.99 | &lt;100 learners |
| 51–99 | 51–99 | IGCSE & A-Level | 0 | 0 | 0 | 580.99 | &lt;100 learners. The file’s next price starts at 100 users, so this tier stops at 99 |
| 100–300 | 100–300 | IGCSE & A-Level | 0 | 0 | 0 | 917.99 | (100+ users). The file has no higher step, so 101–300 is not a separate price |
| 301+ | 301+ | IGCSE & A-Level | 0 | 0 | 0 | 917.99 | Same (100+ users) row |
| same five tiers | same | Primary & Lower Secondary | 0 | 0 | 0 | 0 | No pupil count on Category A–E or Small–Super |
| same five tiers | same | Professional & Degrees | 0 | 0 | 0 | 0 | Not in these files |
| — | — | Add-on ET AI Live | 0 | 0 | 0 | 0 | Not in these files |
| — | — | Add-on Poket Reads | 0 | 0 | 0 | 0 | Not in these files |

Seat count selects the tier. The quote is the platform fee, plus seats times the per-student price, plus the selected add-ons, minus a per-academy discount. A custom per-student amount or a waived platform fee replaces only that academy’s quote. Usage above the purchased seats raises an over-limit notice. Usage that falls in a higher tier asks for that tier. A renewal date inside 45 days, on the day, or in the past is called out on the billing tab. Quote and invoice PDFs print this calculated total.
