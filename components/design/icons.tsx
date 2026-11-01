import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Stroke({ size = 24, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return <Stroke {...props}><path d="M5 12.5 9.2 17 19 7" /></Stroke>;
}

export function IconArrow(props: IconProps) {
  return <Stroke {...props}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Stroke>;
}

export function IconMenu(props: IconProps) {
  return <Stroke {...props}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h12" /></Stroke>;
}

export function IconClose(props: IconProps) {
  return <Stroke {...props}><path d="M6 6l12 12" /><path d="M18 6 6 18" /></Stroke>;
}

export function IconMark(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
      <path d="M12 4c2.4 2.6 3.6 5.2 3.6 8s-1.2 5.4-3.6 8c-2.4-2.6-3.6-5.2-3.6-8S9.6 6.6 12 4z" />
    </Stroke>
  );
}

export function IconCap(props: IconProps) {
  return <Stroke {...props}><path d="m3 10 9-5 9 5-9 5-9-5z" /><path d="M7 12.2V16c1.6 1.4 3.6 2 5 2s3.4-.6 5-2v-3.8" /></Stroke>;
}

export function IconBook(props: IconProps) {
  return <Stroke {...props}><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5z" /><path d="M5 5.5V21" /></Stroke>;
}

export function IconSpark(props: IconProps) {
  return <Stroke {...props}><path d="M12 3.5 13.6 9 19 10.5 13.6 12 12 17.5 10.4 12 5 10.5 10.4 9z" /></Stroke>;
}

export function IconShield(props: IconProps) {
  return <Stroke {...props}><path d="M12 3.5 19 6.5v5.2c0 4.2-2.8 6.8-7 8.8-4.2-2-7-4.6-7-8.8V6.5z" /></Stroke>;
}

export function IconId(props: IconProps) {
  return <Stroke {...props}><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="9" cy="12" r="2" /><path d="M13 10.5h5M13 13.5h4" /></Stroke>;
}

export function IconUsers(props: IconProps) {
  return <Stroke {...props}><circle cx="9" cy="9" r="2.4" /><circle cx="16" cy="10" r="2" /><path d="M4.5 18.5c.6-2.4 2.4-3.7 4.5-3.7s3.9 1.3 4.5 3.7" /><path d="M14 14.8c1.4-.3 2.6.1 3.5 1.2.7.8 1.1 1.7 1.3 2.5" /></Stroke>;
}

export function IconBuilding(props: IconProps) {
  return <Stroke {...props}><path d="M5 20V6.5L12 3l7 3.5V20" /><path d="M9 20v-4h6v4" /><path d="M9 9h.01M12 9h.01M15 9h.01M9 12.5h.01M12 12.5h.01M15 12.5h.01" /></Stroke>;
}

export function IconSchool(props: IconProps) {
  return <Stroke {...props}><path d="M4 10.5 12 6l8 4.5" /><path d="M7 12v5.5h10V12" /><path d="M12 6V4" /></Stroke>;
}
