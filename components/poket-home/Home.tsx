"use client";
import { homeText } from "./home-text";
import { useHomeCopy } from "./use-home-copy";
import { teacherRosterCount } from "@/lib/ai-teachers";
import { LANGUAGES } from "@/lib/languages";
import {
  ArrowRight,
  GraduationCap,
  Globe2,
  Lightbulb,
  MessageCircle,
  Pencil,
  Play,
  UserRound,
} from "lucide-react";
import { PRODUCT_URL } from "@/lib/poket-config";
import { Geometry, PaperPlane, Scene } from "./Brand";
import LearningPreview from "./LearningPreview";
import PlatformShowcase from "./PlatformShowcase";
import Motion from "./Motion";
import AudienceExplorer from "./AudienceExplorer";
import Testimonials from "./Testimonials";
import Pricing from "./Pricing";

export default function PoketHome() {
  const copy = useHomeCopy();
  return (
    <div className="poket-home" data-landing="poket-reference">
      <a className="skip-link" href="#main">
        {homeText("skip_to_content")}
      </a>
      <main id="main">
        <div className="hero-region" id="home">
          <div className="hero-sky">
            <Scene scene="sky" />
          </div>
          <div className="home-header-space" aria-hidden="true" />
          <div className="hero-main">
            <section
              className="hero-section page-container"
              aria-labelledby="hero-heading"
            >
              <div className="hero-copy">
                <p className="hero-eyebrow">
                  {copy("home.v3.eyebrow", "Learning built around you")}
                </p>
                <h1 id="hero-heading">
                  <span>{copy("home.v3.title", "Learn your way.")}</span>
                  <span>{copy("home.v3.titleEm", "Go further with AI.")}</span>
                </h1>
                <p className="hero-description">
                  {copy(
                    "home.v3.lede",
                    "ET AI teachers, creative tools, and your school day — together in one place.",
                  )}
                </p>
                <div className="hero-actions">
                  <a className="button" href={`${PRODUCT_URL}/signup`}>
                    {copy("home.v3.start", "Start free")}
                  </a>
                  <a className="text-link" href="#platform">
                    {homeText("explore_the_platform")} <ArrowRight />
                  </a>
                </div>
              </div>
              <LearningPreview />
            </section>
            <section
              className="trust-section page-container"
              aria-label={homeText("learning_for_every_stage")}
            >
              <div className="trust-grid">
                <div className="trust-item">
                  <span className="trust-icon">
                    <UserRound />
                  </span>
                  <div>
                    <strong>{teacherRosterCount()}</strong>
                    <span>{homeText("et_ai_teachers")}</span>
                  </div>
                </div>
                <div className="trust-item">
                  <span className="trust-icon">
                    <Globe2 />
                  </span>
                  <div>
                    <strong>{LANGUAGES.length}</strong>
                    <span>{homeText("languages")}</span>
                  </div>
                </div>
                <div className="trust-item">
                  <span className="trust-icon">
                    <GraduationCap />
                  </span>
                  <div>
                    <strong>{homeText("primary_to_phd")}</strong>
                    <span>
                      {homeText("from_primary_through_a_level")}
                      <br className="desktop-break" />{" "}
                      {homeText("and_higher_education")}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mobile-partner">
                {homeText(
                  "built_with_rochford_s_international_school_malaysia_2",
                )}
              </p>
            </section>
          </div>
        </div>
        <section
          className="learning-section page-container section-space"
          id="learning"
          aria-labelledby="learning-heading"
        >
          <div className="learning-copy" data-reveal>
            <h2 id="learning-heading">
              {copy("home.v3.teachTitle", "More than one way  to understand.")}
            </h2>
            <p>
              {copy(
                "home.v3.teachLede",
                "Learn with clear lessons, visual explanations and step-by-step hints. Build understanding at your own pace, in your own way.",
              )}
            </p>
            <a className="button" href={`${PRODUCT_URL}/courses`}>
              {homeText("explore_courses")} <ArrowRight />
            </a>
          </div>
          <div className="paper-stack" data-reveal>
            <article className="paper-card paper-peach">
              <Lightbulb className="paper-icon" />
              <h3>{homeText("see_the_idea")}</h3>
              <p>
                {homeText(
                  "watch_a_short_clear_explanation_with_visual_examples",
                )}
              </p>
              <a
                className="paper-example geometry-example"
                href="#preview"
                aria-label={homeText("try_a_visual_lesson")}
              >
                <Geometry />
                <span className="play-button">
                  <Play fill="currentColor" />
                </span>
              </a>
            </article>
            <article className="paper-card paper-lilac">
              <Pencil className="paper-icon" />
              <h3>{homeText("try_it_yourself")}</h3>
              <p>
                {homeText(
                  "practice_with_guided_questions_and_step_by_step_hints",
                )}
              </p>
              <a
                className="paper-example"
                href="#preview"
                aria-label={homeText("try_an_algebra_question")}
              >
                <span>{homeText("solve_for_x")}</span>
                <strong>{homeText("2x_6_14")}</strong>
                <span className="example-answer">{homeText("x")}</span>
              </a>
            </article>
            <article className="paper-card paper-blue">
              <MessageCircle className="paper-icon" />
              <h3>{homeText("explain_it_back")}</h3>
              <p>
                {homeText("use_your_own_words_to_show_what_you_ve_learned")}
              </p>
              <a
                className="paper-example"
                href="#preview"
                aria-label={homeText("explore_a_sample_lesson")}
              >
                <span>{homeText("the_equation_means")}</span>
                <div className="writing-lines">
                  <i />
                  <i />
                  <i />
                </div>
              </a>
            </article>
          </div>
        </section>
        <section
          className="platform-section wide-container"
          id="platform"
          aria-labelledby="platform-heading"
          data-reveal
        >
          <div className="section-heading text-center">
            <h2 id="platform-heading">
              {homeText("one_place_for_your_learning_day")}
            </h2>
            <p>
              {homeText(
                "from_ai_teachers_to_planning_and_progress_everything_wo",
              )}
            </p>
          </div>
          <PlatformShowcase />
        </section>
        <AudienceExplorer />
        <Testimonials />
        <Pricing />
        <section className="closing-section wide-container" data-reveal>
          <Scene scene="sky" className="closing-sky" />
          <div className="closing-copy">
            <h2>
              {homeText("big_possibilities")}
              <br />
              {homeText("a_little_every_day")}
            </h2>
            <p>{homeText("same_curiosity_a_brighter_tomorrow")}</p>
          </div>
          <a className="button" href={`${PRODUCT_URL}/signup`}>
            {copy("home.v3.start", "Start free")}
          </a>
          <PaperPlane />
        </section>
      </main>
      <Motion />
    </div>
  );
}
