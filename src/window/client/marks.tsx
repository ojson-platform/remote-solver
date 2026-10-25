import type {ReactNode} from 'react';
import type {DoorKind} from '../types.ts';

export function Cross(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4.2 4.2 11.8 11.8 M11.8 4.2 4.2 11.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SendMark(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M1.8 8.1 14.2 2.4 9.4 13.8 7.4 8.9 1.8 8.1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M7.4 8.9 14.2 2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const DOOR_PATHS: Record<DoorKind, ReactNode> = {
  plan: (
    <>
      <path
        d="M4.8 2.6h4.1L12.2 5.8V13.4H4.8V2.6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M8.8 2.8v3.2h3.1" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  spec: (
    <path
      d="M3.5 4.5h9M3.5 8h9M3.5 11.5h5.5"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  ),
  design: (
    <path
      d="M9.2 3.1l3.7 3.7-6.4 6.4H2.8V9.5l6.4-6.4z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  ),
  tasks: (
    <>
      <path
        d="M3.2 4.8l1.2 1.2 2.2-2.3M3.2 9l1.2 1.2 2.2-2.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.5 4.8h4.3M8.5 9h4.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  code: (
    <path
      d="M6.2 4.8L3.4 8l2.8 3.2M9.8 4.8L12.6 8 9.8 11.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  check: (
    <path
      d="M3.5 8.2l3 3.1 6-6.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

export function Glyph({name}: {name: 'play' | 'bang' | DoorKind}): ReactNode {
  let body: ReactNode;
  if (name === 'play') {
    body = <path d="M6.2 4.4v7.2L12 8 6.2 4.4z" fill="currentColor" />;
  } else if (name === 'bang') {
    body = (
      <>
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 4.6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="8" cy="11.15" r="0.8" fill="currentColor" />
      </>
    );
  } else {
    body = DOOR_PATHS[name];
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      {body}
    </svg>
  );
}

export function Wizard(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0.4 5.05 4.55 5.7 5.35 0.7 3.15 0.15 4.35 5.45 6.85 3.15 15.7 12.5 15.7 10.35 6.95 15.55 4.15 14.85 2.95 10.15 5.45 10.85 4.55Z"
      />
      <path fill="currentColor" d="M14.35 1.35h1.05V15.7h-1.05z" />
      <circle cx="14.87" cy="1.15" r="0.75" fill="currentColor" />
    </svg>
  );
}

export function Pill({label, disabled}: {label: string; disabled?: boolean}): ReactNode {
  return (
    <button className="cmd" type="submit" disabled={disabled}>
      {label}
    </button>
  );
}

export function Hairline({
  label,
  disabled,
  form,
}: {
  label: string;
  disabled?: boolean;
  form?: string;
}): ReactNode {
  return (
    <button className="quiet" type="submit" form={form} disabled={disabled}>
      {label}
    </button>
  );
}

export function CrossButton({label}: {label: string}): ReactNode {
  return (
    <button className="x" type="submit" aria-label={label}>
      <Cross />
    </button>
  );
}
