"use client";
import { homeText } from "./home-text";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  FileText,
  FlaskConical,
  GraduationCap,
  Leaf,
  NotebookPen,
} from "lucide-react";
import { Avatar } from "./Brand";

export default function PlatformShowcase() {
  const [essayStep, setEssayStep] = useState(0);
  const [studioTab, setStudioTab] = useState("Lesson");
  const [topic, setTopic] = useState("");
  const [sample, setSample] = useState(false);
  const [week, setWeek] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const sampleKind = /algebra|math|equation/i.test(topic)
    ? "Algebra"
    : /english|writing|essay/i.test(topic)
      ? "Persuasive writing"
      : "Photosynthesis";
  const sampleText =
    sampleKind === "Algebra"
      ? {
          Lesson:
            "Subtract 6 from both sides of 2x + 6 = 14, then divide by 2. The answer is x = 4.",
          Quiz: "Solve for x: 2x + 6 = 14",
          Book: "Chapter 1 · Understanding linear equations",
        }
      : sampleKind === "Persuasive writing"
        ? {
            Lesson:
              "Make a clear point, explain your reason, then support it with evidence.",
            Quiz: "What is the purpose of persuasive writing?",
            Book: "Chapter 1 · An idea worth sharing",
          }
        : {
            Lesson:
              "Plants use sunlight, water and carbon dioxide to make glucose.",
            Quiz: "What do plants need to turn sunlight into food?",
            Book: "Chapter 1 · A little world of green",
          };
  const essayCopy = [
    "Here’s a model answer structure for your essay. You can adapt it to your topic.",
    "Choose a clear point. Explain it with a reason, then support it with evidence.",
    "Bring your main idea together and leave the reader with a final thought.",
  ];
  const rows = [
    {
      subject: "Maths",
      task: "Complete worksheet",
      day: "Mon",
      icon: ClipboardList,
      tone: "purple",
    },
    {
      subject: "Biology",
      task: "Read and make notes",
      day: "Tue",
      icon: FileText,
      tone: "orange",
    },
    {
      subject: "English",
      task: "Essay draft",
      day: "Wed",
      icon: NotebookPen,
      tone: "green",
    },
    {
      subject: "Science",
      task: "Quiz practice",
      day: "Thu",
      icon: FlaskConical,
      tone: "blue",
    },
  ];
  return (
    <div className="platform-grid">
      <article className="feature-column">
        <div className="feature-demo english-demo">
          <div className="mini-app-heading">
            <Avatar />
            <strong>{homeText("et_english")}</strong>
          </div>
          <div className="english-message" aria-live="polite">
            {essayCopy[essayStep]}
          </div>
          <strong className="mini-title">{homeText("essay_structure")}</strong>
          <div className="essay-layout">
            <div className="essay-steps">
              {["Introduction", "Main points", "Conclusion"].map((step, i) => (
                <button
                  key={step}
                  className={essayStep === i ? "selected-essay-step" : ""}
                  onClick={() => setEssayStep(i)}
                >
                  <span>{i + 1}</span>
                  {step}
                </button>
              ))}
            </div>
            <div className="essay-paper">
              <FileText />
            </div>
          </div>
        </div>
        <h3>{homeText("a_hint_when_you_need_it")}</h3>
        <p>
          {homeText("get_step_by_step_support_from_35_et_ai_teachers_in_53_l")}
        </p>
      </article>
      <article className="feature-column">
        <div className="feature-demo studio-demo">
          <div className="mini-app-heading">
            <span className="mini-icon blue">
              <GraduationCap />
            </span>
            <strong>{homeText("et_ai_studio")}</strong>
          </div>
          <div
            className="studio-tabs"
            role="tablist"
            aria-label={homeText("studio_preview_type")}
          >
            {["Lesson", "Quiz", "Book"].map((tab) => (
              <button
                role="tab"
                id={`tab-${tab}`}
                aria-selected={studioTab === tab}
                aria-controls="studio-panel"
                key={tab}
                onClick={() => {
                  setStudioTab(tab);
                  setSample(false);
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <div
            className="studio-panel"
            role="tabpanel"
            id="studio-panel"
            aria-labelledby={`tab-${studioTab}`}
          >
            <span className="mini-icon orange">
              {studioTab === "Book" ? (
                <BookOpen />
              ) : studioTab === "Quiz" ? (
                <ClipboardList />
              ) : (
                <FileText />
              )}
            </span>
            <div>
              <strong>
                {sample
                  ? `${sampleKind}: sample ${studioTab.toLowerCase()}`
                  : `Create ${studioTab === "Book" ? "a book" : studioTab === "Quiz" ? "a quiz" : "a lesson"}`}
              </strong>
              <p>
                {sample
                  ? sampleText[studioTab as keyof typeof sampleText]
                  : studioTab === "Book"
                    ? "Give your idea a story, one chapter at a time."
                    : studioTab === "Quiz"
                      ? "Turn a topic into questions that build understanding."
                      : "Turn any topic into a personalised lesson with examples, activities and a quiz."}
              </p>
            </div>
          </div>
          <form
            className="studio-topic"
            onSubmit={(e) => {
              e.preventDefault();
              setSample(true);
            }}
          >
            <input
              aria-label={homeText("sample_studio_topic")}
              placeholder={homeText("e_g_photosynthesis")}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={40}
            />
            <button
              aria-label={homeText("show_sample_studio_content")}
              type="submit"
            >
              <ArrowRight />
            </button>
          </form>
        </div>
        <h3>{homeText("make_something_worth_learning")}</h3>
        <p>
          {homeText("use_et_ai_studio_to_create_your_own_lessons_quizzes_ess")}
        </p>
      </article>
      <article className="feature-column">
        <div className="feature-demo planner-demo">
          <div className="mini-app-heading">
            <span className="mini-icon blue">
              <CalendarDays />
            </span>
            <strong>{homeText("my_planner")}</strong>
            <div className="week-controls">
              <button
                aria-label={homeText("previous_sample_week")}
                disabled={week === 0}
                onClick={() => setWeek((v) => Math.max(0, v - 1))}
              >
                <ChevronLeft />
              </button>
              <span>{week === 0 ? "This week" : "Next week"}</span>
              <button
                aria-label={homeText("next_sample_week")}
                disabled={week === 1}
                onClick={() => setWeek((v) => Math.min(1, v + 1))}
              >
                <ChevronRight />
              </button>
            </div>
          </div>
          <div className="planner-rows">
            {rows.map((row, i) => (
              <button
                className={`planner-row ${completed.includes(i) ? "is-complete" : ""}`}
                key={row.subject}
                onClick={() =>
                  setCompleted((values) =>
                    values.includes(i)
                      ? values.filter((v) => v !== i)
                      : [...values, i],
                  )
                }
                aria-pressed={completed.includes(i)}
              >
                <span className={`mini-icon ${row.tone}`}>
                  {completed.includes(i) ? <Check /> : <row.icon />}
                </span>
                <span>
                  <strong>{row.subject}</strong> —{" "}
                  {week === 0
                    ? row.task
                    : [
                        "Revision practice",
                        "Explore a new topic",
                        "Reading journal",
                        "Review your notes",
                      ][i]}
                </span>
                <small>{row.day}</small>
              </button>
            ))}
          </div>
        </div>
        <h3>{homeText("keep_the_week_in_view")}</h3>
        <p>
          {homeText("plan_your_study_track_attendance_and_see_report_cards_p")}
        </p>
      </article>
    </div>
  );
}
