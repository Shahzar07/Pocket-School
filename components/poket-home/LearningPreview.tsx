"use client";
import { homeText } from "./home-text";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  CircleHelp,
  GraduationCap,
  Home,
  LayoutDashboard,
  ListTodo,
  NotebookPen,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { Avatar, Geometry, Logo, OpenBook, Plant } from "./Brand";

type Subject = "Mathematics" | "Biology" | "English";
const subjects: {
  name: Subject;
  category: string;
  unit: string;
  progress: string;
  percent: number;
  tone: string;
}[] = [
  {
    name: "Mathematics",
    category: "Algebra",
    unit: "Unit 3: Linear equations",
    progress: "3 / 5 lessons",
    percent: 60,
    tone: "peach",
  },
  {
    name: "Biology",
    category: "Living things",
    unit: "Unit 2: Cells",
    progress: "2 / 4 lessons",
    percent: 50,
    tone: "mint",
  },
  {
    name: "English",
    category: "Reading & writing",
    unit: "Unit 1: Persuasive writing",
    progress: "4 / 6 lessons",
    percent: 67,
    tone: "blue",
  },
];
const nav = [
  { label: "My learning", icon: Home },
  { label: "Overview", icon: LayoutDashboard },
  { label: "Courses", icon: BookOpen },
  { label: "Planner", icon: CalendarDays },
  { label: "Progress", icon: TrendingUp },
];

function Tutor({ subject }: { subject: Subject }) {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [correct, setCorrect] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!answer.trim()) {
      setFeedback("Type your answer to try this example");
      setCorrect(false);
      return;
    }
    const value = answer.toLowerCase().replace(/\s/g, "");
    const right =
      subject === "Mathematics"
        ? ["4", "x=4"].includes(value)
        : subject === "Biology"
          ? value.includes("chloroplast")
          : value.includes("opinion") || value.includes("persuade");
    setCorrect(right);
    setFeedback(
      right
        ? "That's it. A little progress, every day."
        : subject === "Mathematics"
          ? "Almost. Divide both sides of 2x = 8 by 2."
          : subject === "Biology"
            ? "A hint: it begins with ‘chloro’ and contains chlorophyll."
            : "Think about a writer trying to change your opinion.",
    );
  }
  return (
    <aside
      className="tutor-panel"
      aria-label={`Interactive ${subject} sample lesson`}
    >
      <div className="tutor-header">
        <Avatar online />
        <div>
          <strong>
            {homeText("et")} {subject === "Mathematics" ? "Maths" : subject}
          </strong>
          <span className="tutor-status">{homeText("sample_lesson")}</span>
        </div>
        <span className="tutor-mobile-greeting">
          {homeText("let_s_solve_this_together")}
        </span>
      </div>
      <p className="tutor-greeting">{homeText("let_s_solve_this_together")}</p>
      <div className="equation">
        {subject === "Mathematics"
          ? "2x + 6 = 14"
          : subject === "Biology"
            ? "How do leaves make food?"
            : "What makes writing persuasive?"}
      </div>
      <div className="tutor-hint">
        {subject === "Mathematics"
          ? "Subtract 6 from both sides."
          : subject === "Biology"
            ? "Plants use sunlight to make glucose."
            : "Persuasive writing aims to influence."}
      </div>
      <div className="equation equation-secondary">
        {subject === "Mathematics"
          ? "2x = 8"
          : subject === "Biology"
            ? "Sunlight + water + CO₂"
            : "An idea + a reason + evidence"}
      </div>
      <form
        onSubmit={submit}
        className={`tutor-question ${correct ? "is-correct" : ""}`}
      >
        <label htmlFor="tutor-answer">
          {correct
            ? "You’ve got it"
            : subject === "Mathematics"
              ? "What is x?"
              : subject === "Biology"
                ? "Where does this happen?"
                : "What does it change?"}
        </label>
        <div className="answer-field">
          <input
            id="tutor-answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={homeText("type_your_answer")}
            autoComplete="off"
            inputMode={subject === "Mathematics" ? "numeric" : "text"}
          />
          <button type="submit" aria-label={homeText("check_your_answer")}>
            {correct ? <Check /> : <ArrowRight />}
          </button>
        </div>
      </form>
      {feedback ? (
        <p
          className={`answer-feedback ${correct ? "correct-feedback" : ""}`}
          role="status"
        >
          {feedback}
        </p>
      ) : null}
    </aside>
  );
}

export default function LearningPreview() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [activeNav, setActiveNav] = useState("My learning");
  const [subject, setSubject] = useState<Subject>("Mathematics");
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [taskDone, setTaskDone] = useState(false);
  const filtered = subjects.filter((item) =>
    `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="workspace hero-workspace" id="preview" data-ready={ready}>
      <aside className="workspace-sidebar">
        <Logo linked={false} />
        <nav aria-label={homeText("learning_preview_navigation")}>
          {nav.map((item) => (
            <button
              key={item.label}
              className={activeNav === item.label ? "is-active" : ""}
              onClick={() => setActiveNav(item.label)}
            >
              <item.icon />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <span className="preview-caption">
          {homeText("interactive_preview")}
        </span>
      </aside>
      <div className="workspace-body">
        <div className="workspace-topbar">
          <div className="mobile-app-name">
            <span>
              <Home />
            </span>
            <strong>{homeText("my_learning")}</strong>
          </div>
          <label className="workspace-search">
            <Search />
            <input
              aria-label={homeText("search_preview_lessons")}
              placeholder={homeText("search_lessons_topics_or_ask_et")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveNav("My learning");
              }}
            />
          </label>
          <div className="workspace-tools">
            <button
              className="calendar-shortcut icon-button"
              aria-label={homeText("open_preview_planner")}
              onClick={() =>
                setActiveNav(
                  activeNav === "Planner" ? "My learning" : "Planner",
                )
              }
            >
              <CalendarDays />
            </button>
            <div className="notification-wrap">
              <button
                className="icon-button"
                aria-label={homeText("show_preview_notifications")}
                aria-expanded={notifications}
                onClick={() => setNotifications((v) => !v)}
              >
                <Bell />
              </button>
              {notifications ? (
                <div className="notification-popover">
                  <CheckCircle2 />
                  <span>{homeText("you_re_all_caught_up")}</span>
                  <button
                    className="icon-button"
                    onClick={() => setNotifications(false)}
                    aria-label={homeText("close_notifications")}
                  >
                    <X />
                  </button>
                </div>
              ) : null}
            </div>
            <Avatar />
          </div>
        </div>
        <div className="workspace-content">
          <div className="learning-main">
            <div className="learning-title">
              <h2>
                {activeNav === "Planner"
                  ? "Your week, in view"
                  : activeNav === "Progress"
                    ? "Every little step counts"
                    : "A little progress, every day"}
              </h2>
              <span className="desktop-date">
                {homeText("sample_learning_day")}
              </span>
            </div>
            {activeNav === "Planner" ? (
              <div className="preview-alternate">
                <h3>
                  <CalendarDays /> {homeText("a_little_plan_for_the_week")}
                </h3>
                {[
                  "Monday · Algebra practice",
                  "Tuesday · Read and make notes",
                  "Wednesday · English essay draft",
                  "Thursday · Science quiz practice",
                ].map((task, i) => (
                  <button
                    key={task}
                    onClick={() => i === 0 && setTaskDone((v) => !v)}
                    className={i === 0 && taskDone ? "completed-task" : ""}
                  >
                    {i === 0 && taskDone ? <CheckCircle2 /> : <Circle />}
                    <span>{task}</span>
                    <span>{i === 0 ? "15 min" : "20 min"}</span>
                  </button>
                ))}
                <button
                  className="back-to-preview"
                  onClick={() => setActiveNav("My learning")}
                >
                  {homeText("back_to_my_learning")} <ArrowRight />
                </button>
              </div>
            ) : activeNav === "Progress" ? (
              <div className="preview-alternate progress-preview">
                <h3>
                  <TrendingUp /> {homeText("your_sample_learning_progress")}
                </h3>
                {subjects.map((item) => (
                  <div className="progress-subject" key={item.name}>
                    <span>{item.name}</span>
                    <strong>{item.progress}</strong>
                    <div className="progress-track">
                      <span style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
                <p>{homeText("one_lesson_at_a_time_keep_going")}</p>
                <button
                  className="back-to-preview"
                  onClick={() => setActiveNav("My learning")}
                >
                  {homeText("continue_learning")} <ArrowRight />
                </button>
              </div>
            ) : (
              <>
                <div className="subject-grid">
                  {filtered.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => setSubject(item.name)}
                      className={`subject-card subject-${item.tone} ${item.name === "Biology" ? "biology-card" : ""}`}
                      aria-label={`Try the ${item.name} sample lesson`}
                    >
                      <h3>{item.name}</h3>
                      <p>{item.category}</p>
                      {item.name === "Mathematics" ? (
                        <Geometry />
                      ) : item.name === "Biology" ? (
                        <Plant />
                      ) : (
                        <OpenBook />
                      )}
                      <div className="progress-track">
                        <span style={{ width: `${item.percent}%` }} />
                      </div>
                      <span className="unit-name">{item.unit}</span>
                      <span className="lesson-count">{item.progress}</span>
                    </button>
                  ))}
                  {filtered.length === 0 ? (
                    <p className="no-results">
                      <Search />
                      {homeText("no_lessons_match")}
                      {query}
                      {homeText("try_mathematics_biology_or_english")}
                    </p>
                  ) : null}
                </div>
                <div className="today-heading">{homeText("today")}</div>
                <div className="today-grid">
                  <button
                    className={`today-task ${taskDone ? "completed-task" : ""}`}
                    onClick={() => setTaskDone((v) => !v)}
                  >
                    {taskDone ? <CheckCircle2 /> : <Circle />}
                    <span>
                      <strong>{homeText("algebra_practice")}</strong>
                      <small>{homeText("15_questions_20_min")}</small>
                    </span>
                    <ArrowRight />
                  </button>
                  <button
                    className="today-task"
                    onClick={() => setSubject("English")}
                  >
                    <NotebookPen />
                    <span>
                      <strong>{homeText("reading_journal")}</strong>
                      <small>{homeText("write_about_a_book_you_enjoy")}</small>
                    </span>
                    <ArrowRight />
                  </button>
                </div>
              </>
            )}
          </div>
          <Tutor subject={subject} key={subject} />
        </div>
        <p className="workspace-partner">
          {homeText("built_with_rochford_s_international_school_malaysia_2")}
        </p>
      </div>
    </div>
  );
}
