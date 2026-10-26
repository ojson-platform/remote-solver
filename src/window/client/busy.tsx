import type {ReactNode} from 'react';

export function BusyEdge({on}: {on: boolean}): ReactNode {
  if (!on) {
    return null;
  }
  return <div className="busy" aria-hidden="true" />;
}
