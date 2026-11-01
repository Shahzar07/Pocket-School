"use client";
import { homeText } from "./home-text";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Quote,
  School,
  Users,
} from "lucide-react";
import { gsap } from "gsap";

/** Design-preview copy only. Replace with permissioned customer quotes before launch. */
const stories = [
  {
    role: "A learner’s perspective",
    label: "Students",
    icon: GraduationCap,
    quote:
      "When I’m stuck, I want a hint that helps me work it out — not just the answer.",
    context: "Learning with a little more understanding",
    tone: "blue",
  },
  {
    role: "A parent’s perspective",
    label: "Parents",
    icon: Users,
    quote:
      "A clear view of goals, attendance and report cards makes the school week easier to follow.",
    context: "Staying close to the little wins",
    tone: "lilac",
  },
  {
    role: "An educator’s perspective",
    label: "Teachers",
    icon: School,
    quote:
      "One place to plan lessons, share resources and keep the class moving forward.",
    context: "More room for the work that matters",
    tone: "peach",
  },
];

export default function Testimonials() {
  const [active, setActive] = useState(0);
  const quote = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<number | null>(null);
  const story = stories[active];
  const change = (direction: number) =>
    setActive((value) => (value + direction + stories.length) % stories.length);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(
      () =>
        gsap.from(".stories__animate", {
          y: 8,
          opacity: 0,
          duration: 0.4,
          stagger: 0.04,
          ease: "power3.out",
          clearProps: "all",
        }),
      quote,
    );
    return () => context.revert();
  }, [active]);
  function keys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    change(event.key === "ArrowLeft" ? -1 : 1);
  }
  function swipe(event: PointerEvent<HTMLDivElement>) {
    if (
      pointerStart.current !== null &&
      Math.abs(event.clientX - pointerStart.current) > 60
    )
      change(event.clientX < pointerStart.current ? 1 : -1);
    pointerStart.current = null;
  }
  return (
    <section
      className="stories page-container section-space"
      aria-labelledby="stories-heading"
      id="stories"
    >
      <div className="stories__intro" data-reveal>
        <div>
          <p className="stories__eyebrow">
            {homeText("a_little_progress_from_every_perspective")}
          </p>
          <h2 id="stories-heading">
            {homeText("the_little_things")}
            <br />
            {homeText("that_make_learning_feel_better")}
          </h2>
        </div>
        <p>
          {homeText("for_the_questions_the_encouragement_and_the_people_who_")}
        </p>
      </div>
      <div
        className="stories__carousel"
        data-tone={story.tone}
        role="region"
        aria-roledescription="carousel"
        aria-label={homeText("illustrative_learner_stories")}
        tabIndex={0}
        onKeyDown={keys}
        onPointerDown={(event) => {
          pointerStart.current = event.clientX;
        }}
        onPointerUp={swipe}
        onPointerCancel={() => {
          pointerStart.current = null;
        }}
      >
        <div className="stories__side">
          <span className="stories__role-icon">
            <story.icon />
          </span>
          <strong>{story.label}</strong>
          <span>
            {homeText("different_journeys")}
            <br />
            {homeText("one_place_to_grow")}
          </span>
          <span className="stories__sample-tag">
            {homeText("sample_story")}
          </span>
        </div>
        <div
          className="stories__quote-wrap"
          ref={quote}
          role="group"
          aria-roledescription="slide"
          aria-label={`${active + 1} of ${stories.length}`}
        >
          <Quote className="stories__quote-mark stories__animate" />
          <blockquote className="stories__animate">{story.quote}</blockquote>
          <div className="stories__byline stories__animate">
            <span className="stories__avatar">
              <story.icon />
            </span>
            <div>
              <strong>{story.role}</strong>
              <span>{story.context}</span>
            </div>
          </div>
        </div>
        <div className="stories__navigation">
          <div
            className="stories__dots"
            aria-label={homeText("choose_a_sample_story")}
          >
            {stories.map((item, index) => (
              <button
                key={item.label}
                aria-label={`Show ${item.label.toLowerCase()} story`}
                aria-pressed={index === active}
                onClick={() => setActive(index)}
              />
            ))}
          </div>
          <div className="stories__arrows">
            <button
              aria-label={homeText("previous_story")}
              onClick={() => change(-1)}
            >
              <ArrowLeft />
            </button>
            <button
              aria-label={homeText("next_story")}
              onClick={() => change(1)}
            >
              <ArrowRight />
            </button>
          </div>
        </div>
      </div>
      <p className="stories__disclosure">
        {homeText("illustrative_learner_perspectives_these_are_sample_stor")}
      </p>
      <span className="sr-only" role="status">
        {story.label} {homeText("story")} {active + 1} {homeText("of")}{" "}
        {stories.length}
      </span>
    </section>
  );
}
