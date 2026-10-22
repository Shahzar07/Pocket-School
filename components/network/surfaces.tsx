'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarCheck,
  ChevronRight,
  Heart,
  Home,
  Link2,
  MessageCircle,
  Moon,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat2,
  Rocket,
  ShieldAlert,
  Sun,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { BRAND } from '@/lib/brand';

/** Android-style shell for network, founders, groups, and safeguarding.
 *  components/dashboard (PR #128) is not on this branch, so this matches that kit's rules.
 */

export type NetworkView =
  | 'home'
  | 'profile'
  | 'feed'
  | 'org'
  | 'recruit'
  | 'founders'
  | 'group'
  | 'safety';

type Screen = NetworkView;

const COPY = {
  kicker: 'Poket School',
  light: 'Switch to light mode',
  dark: 'Switch to dark mode',
  collapse: 'Collapse sidebar',
  expand: 'Expand sidebar',
  ring: 'Club XP this month, 72 percent',
  chart: 'School club activity this week',
  homeTitle: 'Network',
  homeSub: 'People, clubs, and founders in one place.',
  profileTitle: 'Amina Yusuf',
  profileSub: 'Lower Secondary science. Verified work stays verified.',
  feedTitle: 'Feed',
  feedSub: 'Posts from people you know, schools you follow, and skills you share.',
  orgTitle: 'North Academy',
  orgSub: 'A verified school page for news, openings, and career talks.',
  recruitTitle: 'Recruiter search',
  recruitSub: 'Opted-in adults only. Contact details stay hidden until a candidate shares them.',
  foundersTitle: 'Poket School Founders',
  foundersSub: 'Complementary co-founders. Poket School does not vet investments.',
  groupTitle: 'Groups',
  groupSub: 'School clubs stay inside the institution, with a teacher advisor.',
  safetyTitle: 'Safeguarding',
  safetySub: 'The safeguarding lead and admins see the timeline. Parents see a redacted note about their own child.',
  tasksLabel: 'Today',
  categoriesLabel: 'Browse',
  progressLabel: 'Club season',
  verified: 'Verified badge',
  maths: 'IGCSE Mathematics',
  python: 'Python, verified',
  schoolOnly: 'School only',
  handle: 'poketschool.ai/u/amina',
  about: 'I help classmates explain a practical in plain language. This about section is mine to edit. Badges and certificates below are shown, not edited.',
  headline: 'Building calm science lessons for Lower Secondary',
  shareBadge: 'Shared a verified badge with the class.',
  et: 'ET AI',
  perfect: 'Perfect score',
  shareCard: 'Share this badge or certificate',
  tags: '#science @north-academy',
  career: 'Career talk this Friday for A-Level students who want a lab placement.',
  verifiedOrg: 'Verified organisation',
  orgBody: 'Institution page. Domain check plus super admin approval.',
  openings: 'Openings',
  openingBody: 'Lab assistant, part time. Apply with a CV version on the job board.',
  talk: 'Career talk',
  talkBody: 'How a hospital lab hires school leavers. Followers can save a seat.',
  searchTitle: 'Search opted-in adults',
  filters: 'Verified skill Python · Level A-Level · Open to internships · Kuala Lumpur',
  billing: 'Recruiter Pro is off until a super admin enables sandbox billing.',
  rizal: 'Rizal Tan',
  rizalMeta: 'A-Level · Python, verified · IGCSE Mathematics',
  hidden: 'Open to recruiters. Email and phone are hidden.',
  shortlist: 'ET AI shortlist, verified fields only. Rizal Tan, A-Level: Python. Certificates: IGCSE Mathematics.',
  suggestion: 'ET AI suggestion',
  lina: 'Lina Cho',
  linaMeta: 'Business · full time · education · Kuala Lumpur',
  linaWhy: 'Complementary skills. Shared industry. Same commitment.',
  linaNext: 'You are technical and looking for a business partner. Message opens after you both choose interested.',
  skip: 'Skip',
  interested: 'Interested',
  minorNote: 'Under-18 founders stay in a school club with classmates and a teacher. They are not in this public match list.',
  robotics: 'Robotics club',
  roboticsBody: 'Private to North Academy. Teacher advisor required. Waiting for school approval.',
  roles: 'Roles: founder, president, officers, members. Group chat is logged while the advisor is on the group.',
  founderBadge: 'Founder',
  leadership: 'Club leadership, not yet verified',
  severity: 'Severity: high',
  caseBody: 'Category: possible bullying. Space: the class space. Action: the post was removed.',
  guide: 'ET AI conversation guide: start with care, name the category, and say what the school already did.',
  ack: 'Acknowledge',
  view: 'View',
  contact: 'Contact the school',
  resolved: 'Mark resolved',
  caseFile: 'Case file',
  clap: 'Clap',
  comment: 'Comment',
  repost: 'Repost',
  copyLink: 'Copy link',
  xpCaption: 'Group XP toward this month’s club cup.',
  chartCaption: 'Posts, RSVPs, and events across school clubs.',
};

const NAV: { id: Screen; label: string; icon: LucideIcon; badge?: number }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'feed', label: 'Feed', icon: Newspaper, badge: 3 },
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'org', label: 'Organisations', icon: Building2, badge: 1 },
  { id: 'recruit', label: 'Recruit', icon: Briefcase, badge: 2 },
  { id: 'founders', label: 'Founders', icon: Rocket, badge: 4 },
  { id: 'group', label: 'Groups', icon: Users, badge: 1 },
  { id: 'safety', label: 'Safeguarding', icon: ShieldAlert, badge: 1 },
];

const TABS: Screen[] = ['home', 'feed', 'group', 'founders', 'safety'];

const TASKS: { id: Screen; title: string; detail: string; icon: LucideIcon }[] = [
  { id: 'feed', title: 'Reply to Maya', detail: 'Connection request', icon: UserPlus },
  { id: 'group', title: 'Review Robotics club', detail: 'Waiting for school approval', icon: CalendarCheck },
  { id: 'safety', title: 'Acknowledge an alert', detail: 'High severity, class space', icon: ShieldAlert },
];

const TILES: { id: Screen; label: string; detail: string; icon: LucideIcon; badge?: number }[] = [
  { id: 'feed', label: 'Feed', detail: '3 new posts', icon: Newspaper, badge: 3 },
  { id: 'profile', label: 'Profile', detail: 'Your public card', icon: UserRound },
  { id: 'org', label: 'Organisations', detail: '1 update', icon: Building2, badge: 1 },
  { id: 'recruit', label: 'Recruit', detail: '2 saved searches', icon: Briefcase, badge: 2 },
  { id: 'founders', label: 'Founders', detail: '4 suggestions', icon: Rocket, badge: 4 },
  { id: 'group', label: 'Groups', detail: '1 request', icon: Users, badge: 1 },
  { id: 'safety', label: 'Safeguarding', detail: '1 open case', icon: ShieldAlert, badge: 1 },
  { id: 'org', label: 'Events', detail: 'Career talk Friday', icon: CalendarCheck },
];

const BARS = [42, 58, 46, 74, 63, 28, 86];
const BAR_INK = [BRAND.primary, BRAND.blueBright, BRAND.blueDeep, BRAND.good, BRAND.amber, BRAND.primary, BRAND.blueBright];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CSS = `
.pk-net {
  --bg: #F3F7F8;
  --surface: #ffffff;
  --ink: #17343C;
  --muted: #5C7276;
  --line: #D5E3E7;
  --mint: #E5F6EF;
  --shadow: 0 10px 28px rgba(30, 106, 131, 0.08);
  min-height: 100vh;
  display: flex;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-sans), "Plus Jakarta Sans", sans-serif;
}
.pk-net.pk-dark {
  --bg: #0E1C22;
  --surface: #163039;
  --ink: #E7F2F5;
  --muted: #9BB4BB;
  --line: #24515C;
  --mint: #14362C;
  --shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
}
.pk-rail {
  display: none;
  flex-direction: column;
  width: 232px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--line);
  padding: 16px 12px 12px;
  position: sticky;
  top: 0;
  height: 100vh;
  box-sizing: border-box;
}
.pk-rail.is-collapsed { width: 80px; }
.pk-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 0 8px 12px;
  font-weight: 800;
}
.pk-mark {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--ps-hero);
  flex-shrink: 0;
}
.pk-nav { display: flex; flex-direction: column; gap: 4px; overflow: auto; }
.pk-navbtn, .pk-task, .pk-tile, .pk-tab, .pk-iconbtn, .pk-action, .pk-choice {
  font: inherit;
  cursor: pointer;
}
.pk-navbtn {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--ink);
  border-radius: 16px;
  padding: 0 12px;
  font-weight: 650;
  font-size: 14px;
  text-align: left;
}
.pk-navbtn.is-on { background: var(--mint); color: #1E6A83; }
.pk-dark .pk-navbtn.is-on { color: #6FBBCE; }
.pk-navbtn:focus-visible, .pk-task:focus-visible, .pk-tile:focus-visible, .pk-tab:focus-visible, .pk-iconbtn:focus-visible, .pk-action:focus-visible, .pk-choice:focus-visible {
  outline: 3px solid #6FBBCE;
  outline-offset: 2px;
}
.pk-label { white-space: nowrap; }
.pk-rail.is-collapsed .pk-label, .pk-rail.is-collapsed .pk-count { display: none; }
.pk-count {
  margin-left: auto;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: #1E6A83;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
}
.pk-collapse {
  margin-top: auto;
  min-height: 48px;
  border: 0;
  background: transparent;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 16px;
  padding: 0 12px;
  font: inherit;
  font-weight: 650;
  cursor: pointer;
}
.pk-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.pk-header {
  background: var(--ps-hero);
  color: #fff;
  padding: 22px 20px 28px;
  border-radius: 0 0 28px 28px;
}
.pk-header-row { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.pk-kicker { letter-spacing: 0.16em; font-size: 12px; font-weight: 700; margin: 0; text-transform: uppercase; }
.pk-title { font-family: var(--font-display), var(--font-sans), sans-serif; font-size: 32px; line-height: 1.1; margin: 8px 0 0; font-weight: 700; }
.pk-sub { margin: 8px 0 0; max-width: 520px; font-size: 15px; line-height: 1.45; }
.pk-iconbtn {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  border: 0;
  background: rgba(255,255,255,0.18);
  color: #fff;
  display: grid;
  place-items: center;
}
.pk-body { padding: 16px 16px 108px; display: grid; gap: 16px; }
.pk-section { margin: 0; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
.pk-tasks { display: grid; gap: 12px; }
.pk-task {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 72px;
  width: 100%;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 22px;
  box-shadow: var(--shadow);
  padding: 12px 14px;
  color: inherit;
}
.pk-task strong, .pk-tile strong { display: block; font-size: 15px; }
.pk-task span, .pk-tile em, .pk-muted { color: var(--muted); font-style: normal; font-size: 13px; font-weight: 500; }
.pk-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.pk-tile {
  position: relative;
  min-height: 124px;
  border-radius: 22px;
  background: var(--surface);
  border: 1px solid var(--line);
  padding: 14px;
  text-align: left;
  color: inherit;
  box-shadow: var(--shadow);
}
.pk-ico {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: var(--mint);
  color: #1E6A83;
  margin-bottom: 12px;
}
.pk-dark .pk-ico { color: #6FBBCE; }
.pk-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  min-width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #1E6A83;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
  padding: 0 6px;
}
.pk-split { display: grid; gap: 12px; }
.pk-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 22px;
  box-shadow: var(--shadow);
  padding: 16px;
}
.pk-cover { height: 96px; border-radius: 18px; background: var(--ps-hero); }
.pk-pills { display: flex; gap: 8px; flex-wrap: wrap; }
.pk-pill {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  background: var(--mint);
  color: #1E6A83;
  border-radius: 999px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
}
.pk-dark .pk-pill { color: #6FBBCE; }
.pk-mint {
  background: var(--mint);
  border-radius: 16px;
  padding: 12px;
  color: #1E6A83;
}
.pk-dark .pk-mint { color: #E7F2F5; }
.pk-row { display: flex; gap: 8px; flex-wrap: wrap; }
.pk-action, .pk-choice {
  min-height: 48px;
  border-radius: 16px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  font-weight: 700;
}
.pk-choice.is-primary { background: #3FE0D0; color: #203337; border-color: #1E6A83; }
.pk-tabs {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 4px;
  background: var(--surface);
  border-top: 1px solid var(--line);
  padding: 6px 8px calc(8px + env(safe-area-inset-bottom));
  z-index: 5;
}
.pk-tab {
  flex: 1;
  min-height: 56px;
  border: 0;
  background: transparent;
  color: var(--muted);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 700;
}
.pk-tab.is-on { color: #1E6A83; background: var(--mint); }
.pk-days { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); padding: 0 8px; }
.pk-ring-wrap { display: flex; align-items: center; gap: 16px; }
@media (min-width: 800px) {
  .pk-tasks { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .pk-split { grid-template-columns: 280px 1fr; }
}
@media (min-width: 720px) {
  .pk-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (min-width: 960px) {
  .pk-rail { display: flex; }
  .pk-tabs { display: none; }
  .pk-body { padding: 20px 24px 32px; }
}
`;

function titleFor(view: Screen): string {
  if (view === 'feed') return COPY.feedTitle;
  if (view === 'org') return COPY.orgTitle;
  if (view === 'recruit') return COPY.recruitTitle;
  if (view === 'founders') return COPY.foundersTitle;
  if (view === 'group') return COPY.groupTitle;
  if (view === 'safety') return COPY.safetyTitle;
  if (view === 'profile') return COPY.profileTitle;
  return COPY.homeTitle;
}

function blurbFor(view: Screen): string {
  if (view === 'feed') return COPY.feedSub;
  if (view === 'org') return COPY.orgSub;
  if (view === 'recruit') return COPY.recruitSub;
  if (view === 'founders') return COPY.foundersSub;
  if (view === 'group') return COPY.groupSub;
  if (view === 'safety') return COPY.safetySub;
  if (view === 'profile') return COPY.profileSub;
  return COPY.homeSub;
}

export function NetworkPreview({ view, theme }: { view: NetworkView; theme?: 'light' | 'dark' }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mode, setMode] = useState<'light' | 'dark'>(theme ?? 'light');
  const [screen, setScreen] = useState<Screen>(view);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (theme) setMode(theme);
  }, [theme]);

  useEffect(() => {
    if (theme) return;
    if (resolvedTheme === 'dark' || resolvedTheme === 'light') setMode(resolvedTheme);
  }, [resolvedTheme, theme]);

  const dark = mode === 'dark';
  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark';
    setMode(next);
    setTheme(next);
  };

  return (
    <div className={dark ? 'pk-net pk-dark' : 'pk-net'}>
      <style>{CSS}</style>
      <aside className={collapsed ? 'pk-rail is-collapsed' : 'pk-rail'}>
        <div className="pk-brand">
          <span className="pk-mark" />
          <span className="pk-label">{COPY.kicker}</span>
        </div>
        <nav className="pk-nav" aria-label={COPY.homeTitle}>
          {NAV.map(item => {
            const Icon = item.icon;
            const on = screen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={on ? 'pk-navbtn is-on' : 'pk-navbtn'}
                aria-current={on ? 'page' : undefined}
                onClick={() => setScreen(item.id)}
              >
                <Icon size={24} strokeWidth={2} aria-hidden />
                <span className="pk-label">{item.label}</span>
                {item.badge ? <span className="pk-count">{item.badge}</span> : null}
              </button>
            );
          })}
        </nav>
        <button type="button" className="pk-collapse" aria-label={collapsed ? COPY.expand : COPY.collapse} onClick={() => setCollapsed(value => !value)}>
          {collapsed ? <PanelLeftOpen size={24} strokeWidth={2} aria-hidden /> : <PanelLeftClose size={24} strokeWidth={2} aria-hidden />}
          <span className="pk-label">{collapsed ? COPY.expand : COPY.collapse}</span>
        </button>
      </aside>
      <div className="pk-main">
        <header className="pk-header">
          <div className="pk-header-row">
            <div>
              <p className="pk-kicker">{COPY.kicker}</p>
              <h1 className="pk-title">{titleFor(screen)}</h1>
              <p className="pk-sub">{blurbFor(screen)}</p>
            </div>
            <button type="button" className="pk-iconbtn" aria-label={dark ? COPY.light : COPY.dark} onClick={toggleTheme}>
              {dark ? <Sun size={24} strokeWidth={2} aria-hidden /> : <Moon size={24} strokeWidth={2} aria-hidden />}
            </button>
          </div>
        </header>
        <div className="pk-body">
          {screen === 'home' && <HomeScreen onOpen={setScreen} />}
          {screen === 'profile' && <Profile />}
          {screen === 'feed' && <Feed />}
          {screen === 'org' && <Org />}
          {screen === 'recruit' && <Recruit />}
          {screen === 'founders' && <Founders />}
          {screen === 'group' && <Group />}
          {screen === 'safety' && <Safety />}
        </div>
        <nav className="pk-tabs" aria-label={COPY.homeTitle}>
          {TABS.map(id => {
            const item = NAV.find(entry => entry.id === id)!;
            const Icon = item.icon;
            const on = screen === id;
            return (
              <button key={id} type="button" className={on ? 'pk-tab is-on' : 'pk-tab'} aria-current={on ? 'page' : undefined} onClick={() => setScreen(id)}>
                <Icon size={24} strokeWidth={2} aria-hidden />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function HomeScreen({ onOpen }: { onOpen: (screen: Screen) => void }) {
  return (
    <>
      <p className="pk-section">{COPY.tasksLabel}</p>
      <div className="pk-tasks">
        {TASKS.map(task => {
          const Icon = task.icon;
          return (
            <button key={task.title} type="button" className="pk-task" onClick={() => onOpen(task.id)}>
              <span className="pk-ico" style={{ marginBottom: 0 }}>
                <Icon size={24} strokeWidth={2} aria-hidden />
              </span>
              <span>
                <strong>{task.title}</strong>
                <span>{task.detail}</span>
              </span>
              <ChevronRight size={24} strokeWidth={2} aria-hidden style={{ marginLeft: 'auto', color: BRAND.primary }} />
            </button>
          );
        })}
      </div>
      <p className="pk-section">{COPY.categoriesLabel}</p>
      <div className="pk-grid">
        {TILES.map(tile => {
          const Icon = tile.icon;
          return (
            <button key={tile.label} type="button" className="pk-tile" onClick={() => onOpen(tile.id)}>
              {tile.badge ? <span className="pk-badge">{tile.badge}</span> : null}
              <span className="pk-ico">
                <Icon size={24} strokeWidth={2} aria-hidden />
              </span>
              <strong>{tile.label}</strong>
              <em>{tile.detail}</em>
            </button>
          );
        })}
      </div>
      <p className="pk-section">{COPY.progressLabel}</p>
      <div className="pk-split">
        <article className="pk-card pk-ring-wrap">
          <Ring />
          <div>
            <strong>{COPY.progressLabel}</strong>
            <p className="pk-muted">{COPY.xpCaption}</p>
          </div>
        </article>
        <article className="pk-card">
          <strong>{COPY.chartCaption}</strong>
          <ActivityChart />
          <div className="pk-days">
            {DAYS.map(day => <span key={day}>{day}</span>)}
          </div>
        </article>
      </div>
    </>
  );
}

function Ring() {
  const value = 72;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const dash = (value / 100) * circumference;
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label={COPY.ring}>
      <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--line)" strokeWidth="10" />
      <circle
        cx="48"
        cy="48"
        r={radius}
        fill="none"
        stroke={BRAND.primary}
        strokeWidth="10"
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 48 48)"
      />
      <text x="48" y="53" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">{value}</text>
    </svg>
  );
}

function ActivityChart() {
  return (
    <svg viewBox="0 0 280 110" width="100%" height="110" role="img" aria-label={COPY.chart}>
      {BARS.map((height, index) => (
        <rect
          key={DAYS[index]}
          x={16 + index * 38}
          y={100 - height}
          width="22"
          height={height}
          rx="8"
          fill={BAR_INK[index]}
        />
      ))}
    </svg>
  );
}

function Profile() {
  return (
    <section className="pk-card">
      <div className="pk-cover" />
      <h2>{COPY.profileTitle}</h2>
      <p style={{ color: BRAND.primary, fontWeight: 700 }}>{COPY.headline}</p>
      <p>{COPY.about}</p>
      <div className="pk-pills">
        <span className="pk-pill"><BadgeCheck size={24} strokeWidth={2} aria-hidden /> {COPY.verified}</span>
        <span className="pk-pill">{COPY.maths}</span>
        <span className="pk-pill">{COPY.python}</span>
        <span className="pk-pill">{COPY.schoolOnly}</span>
      </div>
      <p className="pk-muted">{COPY.handle}</p>
    </section>
  );
}

function Feed() {
  return (
    <>
      <article className="pk-card">
        <strong>{COPY.profileTitle}</strong>
        <p>{COPY.shareBadge}</p>
        <div className="pk-mint">
          <p style={{ margin: 0 }}>{COPY.et}</p>
          <strong>{COPY.perfect}</strong>
          <p style={{ marginBottom: 0 }}>{COPY.shareCard}</p>
        </div>
        <p style={{ color: BRAND.primary, fontWeight: 700 }}>{COPY.tags}</p>
        <div className="pk-row">
          <button type="button" className="pk-action"><Heart size={24} strokeWidth={2} aria-hidden />{COPY.clap}</button>
          <button type="button" className="pk-action"><MessageCircle size={24} strokeWidth={2} aria-hidden />{COPY.comment}</button>
          <button type="button" className="pk-action"><Repeat2 size={24} strokeWidth={2} aria-hidden />{COPY.repost}</button>
          <button type="button" className="pk-action"><Link2 size={24} strokeWidth={2} aria-hidden />{COPY.copyLink}</button>
        </div>
      </article>
      <article className="pk-card">
        <strong>{COPY.orgTitle}</strong>
        <p>{COPY.career}</p>
      </article>
    </>
  );
}

function Org() {
  return (
    <section className="pk-card">
      <div className="pk-cover" />
      <h2>{COPY.orgTitle}</h2>
      <span className="pk-pill"><BadgeCheck size={24} strokeWidth={2} aria-hidden /> {COPY.verifiedOrg}</span>
      <p>{COPY.orgBody}</p>
      <h3>{COPY.openings}</h3>
      <p>{COPY.openingBody}</p>
      <h3>{COPY.talk}</h3>
      <p>{COPY.talkBody}</p>
    </section>
  );
}

function Recruit() {
  return (
    <>
      <section className="pk-card">
        <h2 style={{ marginTop: 0 }}>{COPY.searchTitle}</h2>
        <p>{COPY.filters}</p>
        <p className="pk-muted">{COPY.billing}</p>
      </section>
      <article className="pk-card">
        <strong>{COPY.rizal}</strong>
        <p>{COPY.rizalMeta}</p>
        <p>{COPY.hidden}</p>
        <p className="pk-mint">{COPY.shortlist}</p>
      </article>
    </>
  );
}

function Founders() {
  return (
    <>
      <article className="pk-card">
        <p style={{ color: BRAND.primary, fontWeight: 700, marginTop: 0 }}>{COPY.suggestion}</p>
        <h2>{COPY.lina}</h2>
        <p>{COPY.linaMeta}</p>
        <p>{COPY.linaWhy}</p>
        <p>{COPY.linaNext}</p>
        <div className="pk-row">
          <button type="button" className="pk-choice">{COPY.skip}</button>
          <button type="button" className="pk-choice is-primary">{COPY.interested}</button>
        </div>
      </article>
      <p className="pk-muted">{COPY.minorNote}</p>
    </>
  );
}

function Group() {
  return (
    <section className="pk-card">
      <div className="pk-cover" style={{ height: 72 }} />
      <h2>{COPY.robotics}</h2>
      <p>{COPY.roboticsBody}</p>
      <p>{COPY.roles}</p>
      <div className="pk-pills">
        <span className="pk-pill">{COPY.founderBadge}</span>
        <span className="pk-pill">{COPY.leadership}</span>
      </div>
    </section>
  );
}

function Safety() {
  return (
    <article className="pk-card">
      <p className="pk-section">{COPY.caseFile}</p>
      <strong>{COPY.severity}</strong>
      <p>{COPY.caseBody}</p>
      <p className="pk-mint">{COPY.guide}</p>
      <div className="pk-row">
        <button type="button" className="pk-choice is-primary">{COPY.ack}</button>
        <button type="button" className="pk-choice">{COPY.view}</button>
        <button type="button" className="pk-choice">{COPY.contact}</button>
        <button type="button" className="pk-choice">{COPY.resolved}</button>
      </div>
    </article>
  );
}
