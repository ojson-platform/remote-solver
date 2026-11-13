import type {ReactNode} from 'react';

import {evaluateSync} from '@mdx-js/mdx';
import {Fragment, createElement} from 'react';
import * as runtime from 'react/jsx-runtime';

const phrasingComponents = {
  p: ({children}: {children: ReactNode}) => createElement(Fragment, null, children),
};

function mdxPhrasing(text: string): ReactNode {
  const {default: Content} = evaluateSync(text, {
    development: false,
    ...runtime,
    useMDXComponents: () => phrasingComponents,
  });
  return createElement(Content);
}

function fenceLine(line: string): ReactNode | undefined {
  if (/^\s*```/.test(line)) {
    return <code>{line}</code>;
  }
  return undefined;
}

function headingLine(line: string): ReactNode | undefined {
  const matched = /^(#{1,6})\s+(.*)$/.exec(line);
  if (!matched?.[2]) {
    return undefined;
  }
  const marks = matched[1].length;
  if (marks === 2 || marks === 3) {
    return undefined;
  }
  return <span>{mdxPhrasing(matched[2])}</span>;
}

function listLine(line: string): ReactNode | undefined {
  const matched = /^(\s*(?:[-*+]|\d+\.)\s+)(.*)$/.exec(line);
  if (!matched) {
    return undefined;
  }
  const marker = matched[1];
  const body = matched[2] ?? '';
  return (
    <span>
      {marker}
      {mdxPhrasing(body)}
    </span>
  );
}

/** One source line rendered as phrasing-only markdown nodes. */
export function sourceLine(line: string): ReactNode {
  return fenceLine(line) ?? headingLine(line) ?? listLine(line) ?? mdxPhrasing(line);
}
