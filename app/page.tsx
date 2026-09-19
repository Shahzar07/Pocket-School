"use client";

import Link from "next/link";
import { useId, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Flame,
  GraduationCap,
  Headphones,
  Layers,
  Mic,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { TIERS, ANNUAL_DISCOUNT } from "@/lib/entitlements";
import { useAuthSTORE } from "@/hooks/use-auth";
import { isAdmin } from "@/lib/roles";
import s from "./home.module.css";

function Cloudscape() {
  return (
    <div className={s.cloudscape} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

function Owl() {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 180 220" aria-hidden="true" className={s.owl}>
      <defs>
        <linearGradient id={gradientId} x2="1" y2="1">
          <stop stopColor="#fff0b0" />
          <stop offset="1" stopColor="#d99935" />
        </linearGradient>
      </defs>
      <ellipse cx="96" cy="203" rx="62" ry="10" fill="#003b56" opacity=".2" />
      <path
        d="M44 102Q12 113 24 161L57 148M137 103Q172 102 169 142L137 153"
        fill="#e4aa46"
        stroke="#f6d17e"
        strokeWidth="3"
      />
      <path
        d="M48 78L44 29 79 50Q100 34 123 50L149 30 145 87Q159 129 144 165Q124 196 86 191Q47 189 43 155Z"
        fill={`url(#${gradientId})`}
      />
      <ellipse cx="94" cy="143" rx="40" ry="43" fill="#fff7d9" />
      <path
        d="M51 70Q72 43 94 73Q119 40 142 68L133 101 59 103Z"
        fill="#fffaf0"
      />
      <circle cx="75" cy="82" r="18" fill="white" />
      <circle cx="120" cy="82" r="18" fill="white" />
      <circle cx="80" cy="83" r="9" fill="#243b48" />
      <circle cx="117" cy="83" r="9" fill="#243b48" />
      <circle cx="82" cy="80" r="3" fill="white" />
      <circle cx="119" cy="80" r="3" fill="white" />
      <path d="M91 97L103 97 97 109Z" fill="#db8024" />
      <path
        d="M57 177L48 194 75 194 80 180M117 179L114 195 143 195 133 178"
        fill="#dc8e2c"
      />
      <path
        d="M47 120L93 134 143 115 140 159 94 179 49 161Z"
        fill="#f3f8f5"
        stroke="#286e85"
        strokeWidth="4"
      />
      <path d="M94 134V178" stroke="#286e85" strokeWidth="3" />
      <path
        d="M57 135L81 144M57 145L80 155M106 141L132 131M106 151L130 141"
        stroke="#b2c9cd"
        strokeWidth="3"
      />
    </svg>
  );
}

function Phone({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`${s.phone} ${compact ? s.compactPhone : ""}`}
      aria-label="Illustrative Poket School learning dashboard"
    >
      <div className={s.phoneNotch} />
      <div className={s.phoneStatus}>
        <b>9:41</b>
        <span>▮▮▮ ▰</span>
      </div>
      <div className={s.phoneWelcome}>
        <span className={s.avatar}>K</span>
        <div>
          <small>Welcome back ☀</small>
          <strong>Karina</strong>
        </div>
        <Mic size={15} />
      </div>
      <div className={s.lessonCard}>
        <div>
          <p>
            Continue your
            <br />
            learning journey.
            <br />
            Get inspired.
          </p>
          <div className={s.lessonCircles}>
            <span>72%</span>
            <Play size={26} />
          </div>
          <small>
            Continue <ArrowRight size={12} />
          </small>
        </div>
        <Owl />
      </div>
      <div className={s.phoneChips}>
        <span>
          <Brain size={12} /> Ayla
        </span>
        <span>
          <Layers size={12} /> My lessons
        </span>
        <span>
          <Zap size={12} /> Quill
        </span>
      </div>
      <div className={s.phoneLesson}>
        <BookOpen size={22} />
        <div>
          <strong>A little progress, every day</strong>
          <small>Your next chapter starts here</small>
        </div>
        <ChevronRight size={14} />
      </div>
      <div className={s.phoneStats}>
        <div>
          <Flame size={19} />
          <b>12 days</b>
          <small>Learning streak</small>
        </div>
        <div>
          <Target size={19} />
          <b>84%</b>
          <small>Weekly goal</small>
        </div>
      </div>
      <div className={s.phoneLesson}>
        <GraduationCap size={22} />
        <div>
          <strong>Discover something new</strong>
          <small>Explore your learning pathway</small>
        </div>
      </div>
      <div className={s.phoneBottom} />
    </div>
  );
}

const features = [
  {
    icon: Brain,
    title: "Your personal AI tutor",
    description:
      "Meet Ayla. Ask questions, explore ideas, and get explanations that make things click.",
    href: "/ai-teachers",
    wide: true,
  },
  {
    icon: Headphones,
    title: "Learn through conversation",
    description:
      "Talk through a tricky topic with an AI teacher, at your own pace.",
    href: "/ai-teachers",
  },
  {
    icon: BookOpen,
    title: "Personalized learning paths",
    description:
      "Find a pathway built around your level, your ambitions, and your goals.",
    href: "/courses",
  },
  {
    icon: Sparkles,
    title: "Turn notes into knowledge",
    description:
      "Create lessons, quizzes, and study materials with Quill in AI Studio.",
    href: "/ai-studio",
  },
  {
    icon: Target,
    title: "Practice that builds confidence",
    description:
      "Put your understanding to the test with quizzes and guided revision.",
    href: "/courses",
  },
  {
    icon: Layers,
    title: "9 academic pathways",
    description:
      "From primary school to IGCSE, A Levels, and professional learning. Keep growing.",
    href: "/courses",
    wide: true,
  },
];
const comparison = [
  ["Learning pace", "One pace for the class", "Your own pace"],
  ["Personalization", "One-size-fits-all", "Built around you"],
  ["Study support", "Scheduled sessions", "AI help on demand"],
  ["Learning formats", "Textbooks and notes", "Visual, audio, and more"],
  ["Getting started", "Fixed timetables", "Explore free previews"],
  ["Progress feedback", "Periodic reports", "Track your learning"],
];

export default function LandingPage() {
  const [annual, setAnnual] = useState(false);
  const { user, profile } = useAuthSTORE();
  const dashboard =
    profile?.role === "teacher"
      ? "/dashboard/teacher"
      : isAdmin(profile)
        ? "/dashboard/admin"
        : profile?.role === "parent"
          ? "/dashboard/parent"
          : "/dashboard/student";
  const startHref = user ? dashboard : "/signup";
  return (
    <main className={s.home}>
      <section className={s.hero}>
        <Cloudscape />
        <div className={s.heroCopy}>
          <Link href="#features" className={s.eyebrow}>
            A world of learning, in your pocket <ArrowRight size={13} />
          </Link>
          <h1>
            Learn your way.
            <br />
            Go further with AI.
          </h1>
          <p>
            Personalized lessons. An AI tutor by your side.
            <br />A brighter learning journey, built around you.
          </p>
          <div className={s.actions}>
            <Link className={s.button} href={startHref}>
              {user ? "Open your dashboard" : "Start learning for free"}{" "}
              <ArrowRight size={15} />
            </Link>
            <Link className={s.textLink} href="#features">
              Explore how it works <Play size={13} />
            </Link>
          </div>
        </div>
        <div className={s.heroShowcase}>
          <div className={s.glassPanel} />
          <div className={`${s.floatingNotes} ${s.notesLeft}`}>
            <div>
              <Flame />
              <span>
                Make small moments count with a little learning, every single
                day.
              </span>
            </div>
            <div>
              <Sparkles />
              <span>Learn in a way that feels natural to you.</span>
            </div>
            <div>
              <Headphones />
              <span>Your AI tutor is always ready to help.</span>
            </div>
          </div>
          <Phone />
          <div className={`${s.floatingNotes} ${s.notesRight}`}>
            <div>
              <Brain />
              <span>
                Tricky concepts made simple.
                <br />
                Meet your personal AI tutor.
              </span>
            </div>
            <div>
              <TrendingUp />
              <span>
                See your progress and build confidence, one lesson at a time.
              </span>
            </div>
            <div>
              <Target />
              <span>Your goals. Your pace. Your next chapter.</span>
            </div>
          </div>
        </div>
        <div className={s.heroMist} />
      </section>
      <div className={s.pathwayStrip} aria-label="Learning pathways">
        {[
          "Primary",
          "IGCSE",
          "A Levels",
          "Foundation",
          "Diplomas",
          "Professional",
        ].map((label, i) => (
          <Link href="/courses" key={label}>
            {i % 2 ? <Layers /> : <GraduationCap />}
            {label}
          </Link>
        ))}
      </div>
      <section className={`${s.section} ${s.features}`} id="features">
        <div className={s.sectionHeading}>
          <div>
            <span className={s.eyebrow}>
              AI-powered learning <Sparkles size={14} />
            </span>
            <h2>
              Everything you need to
              <br />
              <em>become truly confident</em>
            </h2>
          </div>
          <div className={s.ghostOwl}>
            <Owl />
          </div>
        </div>
        <div className={s.featureGrid}>
          {features.map(
            ({ icon: Icon, title, description, href, wide }, index) => (
              <article
                className={`${s.featureCard} ${wide ? s.wideCard : ""}`}
                key={title}
              >
                {index === 0 ? (
                  <div className={s.tutorPreview}>
                    <div>
                      <span>
                        <Sparkles size={13} /> Ask Ayla anything
                      </span>
                      <span>•••</span>
                    </div>
                    <p>“Can you explain photosynthesis?”</p>
                    <div>
                      <span className={s.tutorAnswer}>
                        <Brain size={13} /> Let&apos;s break it down, together.
                      </span>
                      <span>↗</span>
                    </div>
                  </div>
                ) : index === 5 ? (
                  <div className={s.subjectPreview}>
                    {["Sciences", "Languages", "Mathematics", "Arts"].map(
                      (t, i) => (
                        <span key={t}>
                          <i
                            style={{
                              background: [
                                "#ba9ad5",
                                "#6cac82",
                                "#e6c765",
                                "#de9993",
                              ][i],
                            }}
                          />
                          {t}
                        </span>
                      ),
                    )}
                  </div>
                ) : (
                  <div className={s.iconTile}>
                    <Icon size={23} />
                  </div>
                )}
                <h3>{title}</h3>
                <p>{description}</p>
                <Link href={href}>
                  Learn more <ArrowRight size={14} />
                </Link>
              </article>
            ),
          )}
        </div>
      </section>
      <section className={s.comparison} id="difference">
        <Cloudscape />
        <div className={s.section}>
          <div className={s.comparisonHeading}>
            <div>
              <span className={s.eyebrow}>
                The difference <Layers size={14} />
              </span>
              <h2>
                Old way vs.
                <br />
                the Poket School way
              </h2>
            </div>
            <div>
              <p>
                Learning should open doors. Discover a more flexible way to
                understand, practice, and grow.
              </p>
              <Link href={startHref} className={s.button}>
                Start learning with Poket <ArrowRight size={14} />
              </Link>
            </div>
          </div>
          <div className={s.comparisonGrid}>
            {[false, true].map((positive) => (
              <article
                className={`${s.comparisonCard} ${positive ? s.positive : ""}`}
                key={String(positive)}
              >
                <header>
                  {positive ? <GraduationCap /> : <BookOpen />}
                  <div>
                    <h3>
                      {positive ? "Poket School / AI" : "Traditional learning"}
                    </h3>
                    <p>
                      {positive
                        ? "Personal. Flexible. AI-powered."
                        : "Textbooks. Classes. Fixed schedules."}
                    </p>
                  </div>
                </header>
                <dl>
                  {comparison.map(([label, old, next]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>
                        {positive ? <CheckCircle2 size={12} /> : <span>×</span>}
                        {positive ? next : old}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className={`${s.section} ${s.progress}`} id="progress">
        <div
          className={s.progressBoard}
          role="img"
          aria-label="Example progress dashboard: a 12-day streak, 84 percent weekly goal, and a weekly activity chart"
        >
          <span className={s.exampleLabel}>Example learning activity</span>
          <div className={s.statGrid}>
            <div>
              <span>
                <Flame size={17} /> Daily streak
              </span>
              <strong>12 Days</strong>
              <div className={s.progressTrack}>
                <i />
              </div>
            </div>
            <div>
              <span>
                <TrendingUp size={17} /> Weekly goal
              </span>
              <strong>84%</strong>
              <small>A little closer, every day</small>
            </div>
          </div>
          <div className={s.chart}>
            <div>
              <b>Learning this week</b>
              <span>↗ Keep it up</span>
            </div>
            <div className={s.bars}>
              {[25, 43, 65, 91, 34, 55, 42].map((height, i) => (
                <div key={i}>
                  <i style={{ height: `${height}%` }} />
                  <span>
                    {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={s.progressCopy}>
          <span className={s.eyebrow}>
            Every little step counts <Zap size={14} />
          </span>
          <h2>
            Visualize your journey
            <br />
            <em>with Poket School.</em>
          </h2>
          <p>
            See how far you&apos;ve come. Follow your progress, celebrate small
            wins, and make your next move with confidence.
          </p>
          <ul>
            {[
              "Subject-by-subject progress",
              "Personal learning goals",
              "Milestones worth celebrating",
            ].map((t) => (
              <li key={t}>
                <CheckCircle2 size={18} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className={`${s.section} ${s.pricing}`} id="pricing">
        <div className={s.pricingHeading}>
          <div>
            <span className={s.eyebrow}>
              Pricing <Layers size={14} />
            </span>
            <h2>
              Simple, transparent pricing
              <br />
              <em>for every learner</em>
            </h2>
          </div>
          <div>
            <p>
              Start with a free preview. Choose the learning pathway that&apos;s
              right for you.
            </p>
            <div
              className={s.billingToggle}
              role="group"
              aria-label="Billing period"
            >
              <button aria-pressed={!annual} onClick={() => setAnnual(false)}>
                Monthly
              </button>
              <button aria-pressed={annual} onClick={() => setAnnual(true)}>
                Yearly <span>(25% off)</span>
              </button>
            </div>
          </div>
        </div>
        <div className={s.priceGrid}>
          {[TIERS[0], TIERS[1], TIERS[2]].map((tier, i) => (
            <article
              className={`${s.priceCard} ${i === 1 ? s.featuredPrice : ""}`}
              key={tier.id}
            >
              <div className={s.priceTop}>
                <div>
                  <small>
                    {
                      [
                        "Explore",
                        "Build your foundation",
                        "Take the next step",
                      ][i]
                    }
                  </small>
                  <h3>{tier.name}</h3>
                </div>
                {i === 0 ? (
                  <BookOpen />
                ) : i === 1 ? (
                  <GraduationCap />
                ) : (
                  <Sparkles />
                )}
              </div>
              <p>{tier.blurb}</p>
              <div className={s.priceAction}>
                <div>
                  <strong>
                    $
                    {annual
                      ? ((tier.usd ?? 0) * (1 - ANNUAL_DISCOUNT)).toFixed(
                          tier.usd ? 2 : 0,
                        )
                      : tier.usd}
                  </strong>
                  <small>/month</small>
                </div>
                <Link
                  href={i === 0 ? "/courses" : "/pricing"}
                  className={s.button}
                >
                  {i === 0 ? "Explore free" : "View plan"}{" "}
                  <ArrowRight size={14} />
                </Link>
              </div>
              <small className={s.billingNote}>
                {annual && tier.usd
                  ? `$${(tier.usd * (1 - ANNUAL_DISCOUNT) * 12).toFixed(0)} billed yearly · USD`
                  : "USD · " +
                    (tier.usd ? "Billed monthly" : "No subscription needed")}
              </small>
              <ul>
                {[
                  ...tier.programmes,
                  ...(tier.sparks
                    ? [
                        `${tier.sparks.toLocaleString()} Sparks per month`,
                        "AI-powered learning tools",
                      ]
                    : []),
                ].map((t) => (
                  <li key={t}>
                    <CheckCircle2 size={15} />
                    {t}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <Link className={s.allPlans} href="/pricing">
          Compare all plans, degrees, and institution options{" "}
          <ArrowRight size={14} />
        </Link>
      </section>
      <section className={s.finalCta}>
        <Cloudscape />
        <div className={s.ctaInner}>
          <div>
            <span className={s.eyebrow}>
              Your next chapter <BookOpen size={14} />
            </span>
            <h2>
              A little curiosity.
              <br />A whole world of possibility.
            </h2>
            <p>
              Your goals are closer than you think. Start exploring
              <br />a learning experience that&apos;s made for you.
            </p>
            <div className={s.actions}>
              <Link href={startHref} className={s.button}>
                Start learning for free <ArrowRight size={14} />
              </Link>
              <Link href="/courses" className={s.textLink}>
                Explore courses <ArrowRight size={14} />
              </Link>
            </div>
          </div>
          <div className={s.ctaPhone}>
            <div className={s.ctaNote}>
              <Headphones size={24} />
              <span>
                Learn a little. Discover a lot.
                <br />
                Your AI tutor is by your side.
              </span>
            </div>
            <Phone compact />
          </div>
        </div>
      </section>
    </main>
  );
}
