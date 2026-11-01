import { homeText } from "./home-text";
import type { CSSProperties } from "react";

/** Original approved artwork, framed without redrawing the custom lettering. */
export function Logo({
  className = "",
  linked = true,
}: {
  className?: string;
  linked?: boolean;
}) {
  const artwork = (
    <svg
      className={`poket-logo ${className}`}
      viewBox="0 0 1080 312"
      role="img"
      aria-label="Poket"
    >
      <image href="/images/poket-wordmark.webp" width="1080" height="312" />
    </svg>
  );
  return linked ? (
    <a className="brand-link" href="/" aria-label={homeText("poket_home")}>
      {artwork}
    </a>
  ) : (
    artwork
  );
}

const scenes = {
  sky: "0 0 1536 512",
  student: "0 512 512 512",
  parent: "512 512 512 512",
  teacher: "1024 512 512 512",
  avatar: "180 560 260 260",
};

export function Scene({
  scene,
  className = "",
  label,
  style,
}: {
  scene: keyof typeof scenes;
  className?: string;
  label?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={`scene-image ${className}`}
      viewBox={scenes[scene]}
      preserveAspectRatio={scene === "sky" ? "none" : "xMidYMid slice"}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={!label}
      style={style}
    >
      <image
        href="/images/poket-scenes-optimized.webp"
        width="1536"
        height="1024"
      />
    </svg>
  );
}

export function Avatar({
  className = "",
  online = false,
}: {
  className?: string;
  online?: boolean;
}) {
  return (
    <span className={`avatar ${className}`}>
      <Scene scene="avatar" label="ET teacher" />
      {online ? <span className="online-dot" /> : null}
    </span>
  );
}

export function Geometry({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 104"
      className={`subject-art ${className}`}
      fill="none"
      aria-hidden="true"
    >
      <path d="M22 88 81 10 140 88H22Z" />
      <path
        d="M81 10 62 89M22 88l92-60 26 60M81 10l33 18-52 61M22 88l59-20 59 20M81 10v58"
        opacity=".85"
      />
      <circle cx="81" cy="10" r="2" fill="currentColor" stroke="none" />
      <circle cx="22" cy="88" r="2" fill="currentColor" stroke="none" />
      <circle cx="140" cy="88" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Plant() {
  return (
    <svg
      viewBox="0 0 160 104"
      className="subject-art"
      fill="none"
      aria-hidden="true"
    >
      <path d="M80 96V23M80 76C48 76 38 57 40 31c27-1 43 16 40 45ZM81 54c-4-27 9-43 36-44 0 27-12 45-36 44ZM81 92c3-24 15-33 37-32-3 23-15 34-37 32Z" />
      <path d="m43 34 36 42m36-63L82 53m32 11L82 89" />
      <path
        d="M40 31c27-1 43 16 40 45-32 0-42-19-40-45ZM81 54c-4-27 9-43 36-44 0 27-12 45-36 44Z"
        fill="currentColor"
        opacity=".08"
      />
    </svg>
  );
}

export function OpenBook({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 104"
      className={`subject-art ${className}`}
      fill="none"
      aria-hidden="true"
    >
      <path d="M80 22c-17-12-40-13-59-8v67c22-4 43 0 59 10 16-10 37-14 59-10V14c-19-5-42-4-59 8Z" />
      <path d="M80 22v69M21 22l-7 2v64c23-5 47-1 66 9 19-10 43-14 66-9V24l-7-2M33 30c11-1 22 1 34 6M33 43c11-1 22 1 34 6M33 56c11-1 22 1 34 6m26-26c12-5 23-7 34-6m-34 19c12-5 23-7 34-6m-34 19c12-5 23-7 34-6" />
    </svg>
  );
}

export function PaperPlane() {
  return (
    <svg
      className="paper-plane"
      viewBox="0 0 300 140"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 136c39-45 66 11 105-23 20-17 11-42 40-56"
        stroke="#61b4ef"
        strokeDasharray="7 8"
        strokeWidth="2"
      />
      <path d="m139 34 133-23-83 86-12-40-38-23Z" fill="#8dd2ff" />
      <path d="m177 57 95-46-83 86-12-40Z" fill="#62b8f4" />
      <path d="m177 57 11 40 11-28 73-58-95 46Z" fill="#b9e4ff" />
    </svg>
  );
}

export function SocialIcon({
  kind,
}: {
  kind: "youtube" | "instagram" | "linkedin";
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      {kind === "youtube" ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="4" />
          <path d="m10 9 5 3-5 3Z" fill="currentColor" stroke="none" />
        </>
      ) : kind === "instagram" ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7.5 10v7m4-7v7m0-4c0-4 5-4 5 0v4" />
          <circle cx="7.5" cy="7" r="1" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}
