import {useEffect, useRef, type ReactNode} from 'react';
import mermaid from 'mermaid';

let mermaidReady = false;

function prepareMermaid(): void {
  if (mermaidReady) {
    return;
  }
  mermaid.initialize({startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true});
  mermaidReady = true;
}

/** One mermaid chart. The static tree carries the chart; the browser draws the picture. */
export function Diagram({chart}: {chart: string}): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = host.current;
    if (!node) {
      return;
    }
    let cancel = false;
    prepareMermaid();
    const id = `diagram-${Math.random().toString(36).slice(2)}`;
    void mermaid.render(id, chart).then(
      drawn => {
        if (!cancel) {
          node.innerHTML = drawn.svg;
        }
      },
      () => {
        if (!cancel) {
          node.textContent = chart;
        }
      },
    );
    return () => {
      cancel = true;
    };
  }, [chart]);
  return <div className="diagram" data-chart={chart} ref={host} />;
}
