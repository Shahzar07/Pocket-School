import type { SVGProps } from "react";

/** The approved Poket lettering and pictorial mark, kept as one artwork. */
export function PoketWordmark({
  className = "",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1080 312"
      role="img"
      aria-label="Poket"
      className={`poket-wordmark ${className}`}
      {...props}
    >
      <image href="/images/poket-wordmark.webp" width="1080" height="312" />
    </svg>
  );
}

export function PoketMark({
  className = "",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 290 312"
      aria-hidden="true"
      className={`poket-symbol ${className}`}
      {...props}
    >
      <image href="/images/poket-mark.webp" width="290" height="312" />
    </svg>
  );
}
