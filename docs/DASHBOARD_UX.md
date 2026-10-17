# Dashboard UX

The signed-in home for every role uses one kit. Web pages and the Poketschool app should match this layout, the category colours, and the navigation rules. Import the kit from `components/dashboard`. The role map lives in `lib/dashboard/home.ts`.

A public stand-in for screenshots and design review is `/preview/dashboard?role=student|parent|teacher|institution|admin|alumni|recruiter`. It does not read accounts.

## Components

| Piece | Where | What it does |
|---|---|---|
| Home | `components/dashboard/home-view.tsx` | Greeting on the brand gradient, quick-action chips, three tasks, stat cards, an alert, and the category grid. |
| Live home | `components/dashboard/live-home.tsx` | Same home, with tile order and the first-run note stored in the browser. |
| Shell | `components/dashboard/shell.tsx` | Preview chrome: collapsible sidebar, search, bell, profile, bottom tabs, and the main action. |
| Cards | `components/dashboard/cards.tsx` | Stat card, sparkline, progress ring, list, alert, empty state, skeleton, badge art, sample map. |
| Icons | `components/dashboard/icons.tsx` | One Lucide set, 24px, rounded strokes. |
| Search | `components/dashboard/command-palette.tsx` | Cmd/Ctrl-K over the role’s own links. `/` still focuses course search. |
| Tabs and action | `components/shell/mobile-nav.tsx` | Four tabs plus More, and the floating main action, under 1024px. |

Primary action buttons use the cyan fill `#3FE0D0` (`--ps-cyan`) with ink `#203337` (`--ps-cyan-ink`) and a 1px `#1E6A83` border (`--ps-cyan-border`). The fill alone is about 1.6:1 on white, so the border is part of the control. Do not put white text on that fill, and do not use `#14B8A6` or the cyan fill as text on a light background. Text and links on light backgrounds use `--ps-cyan-text` (`#1E6A83`). Brand blue controls that still set `bg-primary` keep `text-primary-foreground`. Do not put `text-white` on `bg-primary`, and do not hardcode `#2786A4`.

Tiles use radius 18. The greeting and list cards use radius 24. Touch targets are at least 48px (`min-h-12`, tab bar 64px). Motion uses `motion-safe` utilities so reduced-motion settings skip the moves. Skeletons use `.ps-skeleton`, which already stops when motion is reduced.

Charts use the brand chart inks (`--chart-1` and the rest). Alert tones are good, cyan, coral, and critical, from `--ps-good`, `--ps-cyan-text`, `--ps-coral`, and `--destructive`.

## Category map

Each category has one icon, a soft wash, and an ink that is readable on that wash.

| Category | Icon | Wash | Ink |
|---|---|---|---|
| Learning | `book-open` | `--ps-wash` | `--ps-blue-deep` |
| Progress | `activity` | `--ps-mint` | `--ps-mint-ink` |
| Messages | `message-square` | `--accent` | `--ps-sky` |
| Community | `users` | `--ps-wash` | `--ps-violet` |
| Careers | `briefcase` | `--ps-cyan-soft` | `--ps-cyan-text` |
| Payments | `credit-card` | `--ps-cyan-soft` | `--ps-cyan-text` |
| Safety | `shield` | `--ps-coral-soft` | `--ps-coral` |
| Settings | `settings` | `--muted` | `--foreground` |
| Insights | `bar-chart-3` | `--ps-mint` | `--ps-mint-ink` |
| People | `users-round` | `--ps-wash` | `--ps-blue-deep` |

## Navigation

- Desktop: a sidebar grouped by those categories. Collapsing it leaves the 24px icons. The profile menu, search, and the bell stay in the top bar. The bell groups notices by push category: progress, grades, assignments, goals, attendance, flags, digests, general.
- Mobile width: four tabs plus More. More opens the rest of the tiles. A floating action button is the role’s main job.
- The three tasks on the home are the jobs that should be one tap away. Everything else is a tile under More.

| Role | Main action | Three tasks |
|---|---|---|
| Student | Continue lesson | Continue lesson, Today’s quest, Progress |
| Parent | Message the school | Child progress, Alerts, Payments |
| Teacher | Mark work | Class risk, Marking, Attendance |
| Institution admin | Review joins | Seats and billing, Joins queue, Insights |
| Super admin | Open insights | Insights, Moderation, Institutions |
| Alumni | Update profile | Certificates, Profile, Messages |
| Recruiter | Search talent | Search, Talent lists, Messages |

Alumni and recruiter homes reuse this kit. They do not own certificates, CVs, or talent data. A recruiter sees only a list a school has shared. The home does not invent people or scores.

Parents get a child switcher on the greeting. Institution and super-admin homes can show a sample activity map; a live map should use only a region the school has saved. Recognition badges are private or for the school. They are not a ranking.

## Personalising and the first visit

Arrange on the home moves tiles earlier or later. The web app stores that order in `localStorage` under `poket-dash-tiles:{role}` as a JSON array of tile ids. The first-run note points at `/onboarding` and is dismissed into `poket-dash-coach:{role}`.

The mobile app should store the same order on the user document so a phone and the web can match. See `docs/SCHEMA_CHANGES.md`.

## Loading

Homes render skeleton blocks before numbers arrive. The preview route has no account calls, which is the light path used to check the layout.
