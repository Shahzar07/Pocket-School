"use client";
import { homeText } from "./home-text";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  GraduationCap,
  School,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { gsap } from "gsap";
import { Scene } from "./Brand";
import { useHomeCopy } from "./use-home-copy";
import { PRODUCT_URL } from "@/lib/poket-config";

const audiences = [
  {
    id: "students",
    label: "Students",
    detail: "Follow your curiosity",
    icon: GraduationCap,
    scene: "student" as const,
    photo: "A learner writing in her notebook beside a laptop",
    eyebrow: "For your next little breakthrough",
    title: "Your pace. Your questions. Your way forward.",
    description:
      "Explore a new subject, work through a tricky idea, or pick up where you left off. There’s room to learn your way.",
    features: [
      {
        icon: BookOpen,
        title: "A hint, not just an answer",
        text: "Work through ideas with step-by-step ET AI guidance.",
      },
      {
        icon: Target,
        title: "A clear next step",
        text: "Keep your courses, goals and practice together.",
      },
      {
        icon: TrendingUp,
        title: "Progress you can see",
        text: "Build understanding one lesson at a time.",
      },
    ],
    action: "Find your next lesson",
    href: "/signup?role=student",
    sampleTitle: "A little progress, every day",
    sampleLabel: "Mathematics · Linear equations",
  },
  {
    id: "parents",
    label: "Parents",
    detail: "Stay close to the journey",
    icon: Users,
    scene: "parent" as const,
    photo: "A mother and her son reading a book together",
    eyebrow: "For the people cheering them on",
    title: "See the week. Support the little wins.",
    description:
      "Stay connected to their learning without guessing what happened today. A linked parent view brings the important things into focus.",
    features: [
      {
        icon: CalendarDays,
        title: "The week in view",
        text: "Follow the planner, goals and upcoming work.",
      },
      {
        icon: ClipboardList,
        title: "Fewer missing pieces",
        text: "See attendance and published report cards together.",
      },
      {
        icon: TrendingUp,
        title: "Know where to encourage",
        text: "Understand progress and the next learning steps.",
      },
    ],
    action: "Explore the parent view",
    href: "/signup?role=parent",
    sampleTitle: "Their week, a little clearer",
    sampleLabel: "A shared view of the school day",
  },
  {
    id: "teachers",
    label: "Teachers & schools",
    detail: "Bring learning together",
    icon: School,
    scene: "teacher" as const,
    photo: "A teacher planning a lesson at a bright desk",
    eyebrow: "For the people making learning happen",
    title: "More room to teach. One place to connect.",
    description:
      "Bring your lessons, resources and classroom routines into one learning space, with a clear view of the people you teach.",
    features: [
      {
        icon: FileText,
        title: "Create with ET AI Studio",
        text: "Build lessons, quizzes, essays and books from a topic.",
      },
      {
        icon: Users,
        title: "Your class, connected",
        text: "Invite learners into private classrooms by code or link.",
      },
      {
        icon: ClipboardList,
        title: "Keep the essentials together",
        text: "Connect the gradebook, planner and attendance.",
      },
    ],
    action: "Explore Poket for schools",
    href: "/institutions",
    sampleTitle: "Your classroom essentials",
    sampleLabel: "From the first lesson to the next step",
  },
];

export default function AudienceExplorer() {
  const copy = useHomeCopy();
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const item = audiences[active];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.from(".audience-explorer__animate", {
        opacity: 0,
        y: 10,
        duration: 0.4,
        stagger: 0.045,
        ease: "power3.out",
        clearProps: "all",
      });
    }, stage);
    return () => context.revert();
  }, [active]);

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % audiences.length;
    else if (event.key === "ArrowLeft")
      next = (index + audiences.length - 1) % audiences.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = audiences.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <section
      className="audience-section audience-explorer page-container section-space"
      id="for-everyone"
      aria-labelledby="audience-heading"
    >
      <div className="section-heading text-center" data-reveal>
        <h2 id="audience-heading">
          {homeText("room_for_every_kind_of_learner")}
        </h2>
        <p>
          {homeText("different_roles_shared_possibilities_find_your_place_in")}
        </p>
      </div>
      <div
        className="audience-explorer__tabs"
        role="tablist"
        aria-label={homeText("choose_your_poket_view")}
      >
        {audiences.map((audience, index) => (
          <button
            key={audience.id}
            role="tab"
            id={`audience-tab-${audience.id}`}
            aria-controls="audience-panel"
            aria-selected={index === active}
            tabIndex={index === active ? 0 : -1}
            ref={(el) => {
              tabs.current[index] = el;
            }}
            onClick={() => setActive(index)}
            onKeyDown={(event) => navigate(event, index)}
          >
            <span className="audience-explorer__tab-icon">
              <audience.icon />
            </span>
            <span>
              <strong>
                {copy(`landing.audiences.${audience.id}.tab`, audience.label)}
              </strong>
              <small>{audience.detail}</small>
            </span>
          </button>
        ))}
      </div>
      <div
        ref={stage}
        className="audience-explorer__stage"
        data-audience={item.id}
        role="tabpanel"
        id="audience-panel"
        aria-labelledby={`audience-tab-${item.id}`}
        tabIndex={0}
      >
        <div className="audience-explorer__photo audience-explorer__animate">
          <Scene scene={item.scene} label={item.photo} />
          <span className="audience-explorer__photo-label">
            <item.icon />
            {homeText("learning_built_around_you")}
          </span>
          <div className="audience-explorer__sample">
            <span className="audience-explorer__sample-label">
              {homeText("example_view")}
            </span>
            <strong>{item.sampleTitle}</strong>
            <p>{item.sampleLabel}</p>
            {active === 0 ? (
              <div className="audience-explorer__lesson">
                <span>{homeText("3_of_5_lessons")}</span>
                <span>
                  {homeText("keep_going")} <ArrowRight />
                </span>
                <div>
                  <i />
                </div>
              </div>
            ) : (
              <div className="audience-explorer__essentials">
                {(active === 1
                  ? ["Goals", "Attendance", "Report cards"]
                  : ["Lessons", "Classrooms", "Gradebook"]
                ).map((text) => (
                  <span key={text}>
                    <Check />
                    {text}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="audience-explorer__content">
          <p className="audience-explorer__eyebrow audience-explorer__animate">
            {item.eyebrow}
          </p>
          <h3 className="audience-explorer__title audience-explorer__animate">
            {copy(`landing.audiences.${item.id}.title`, item.title)}
          </h3>
          <p className="audience-explorer__description audience-explorer__animate">
            {copy(`landing.audiences.${item.id}.body`, item.description)}
          </p>
          <ul className="audience-explorer__features audience-explorer__animate">
            {item.features.map((feature) => (
              <li key={feature.title}>
                <span>
                  <feature.icon />
                </span>
                <div>
                  <strong>{feature.title}</strong>
                  <p>{feature.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="audience-explorer__action audience-explorer__animate">
            <a className="button" href={`${PRODUCT_URL}${item.href}`}>
              {item.action}
              <ArrowRight />
            </a>
            {active === 2 ? (
              <small>
                {homeText(
                  "built_with_rochford_s_international_school_malaysia",
                )}
              </small>
            ) : null}
          </div>
        </div>
      </div>
      <p className="audience-explorer__footnote">
        {homeText("one_login_a_shared_view_of_progress")}
      </p>
      <span className="sr-only" role="status">
        {homeText("showing_the")} {item.label.toLowerCase()} {homeText("view")}
      </span>
    </section>
  );
}
