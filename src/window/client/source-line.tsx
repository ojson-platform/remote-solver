import type {ReactNode} from 'react';

import {Fragment} from 'react';

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
  return <span>{parseInline(matched[2])}</span>;
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
      {parseInline(body)}
    </span>
  );
}

type Token =
  | {kind: 'text'; value: string}
  | {kind: 'strong'; value: string}
  | {kind: 'em'; value: string}
  | {kind: 'code'; value: string}
  | {kind: 'link'; label: string; href: string};

function nextToken(text: string, from: number): {token: Token; next: number} | undefined {
  const slice = text.slice(from);
  const link = /^\[([^\]]+)\]\(([^)]+)\)/.exec(slice);
  if (link?.[1] && link[2]) {
    return {token: {kind: 'link', label: link[1], href: link[2]}, next: from + link[0].length};
  }
  const code = /^`([^`]+)`/.exec(slice);
  if (code?.[1]) {
    return {token: {kind: 'code', value: code[1]}, next: from + code[0].length};
  }
  const strong = /^\*\*([^*]+)\*\*/.exec(slice);
  if (strong?.[1]) {
    return {token: {kind: 'strong', value: strong[1]}, next: from + strong[0].length};
  }
  const em = /^\*([^*]+)\*/.exec(slice);
  if (em?.[1]) {
    return {token: {kind: 'em', value: em[1]}, next: from + em[0].length};
  }
  const plain = slice[0];
  if (!plain) {
    return undefined;
  }
  let end = from + 1;
  while (end < text.length) {
    const rest = text.slice(end);
    if (/^\[/.test(rest) || /^`/.test(rest) || /^\*\*/.test(rest) || /^\*/.test(rest)) {
      break;
    }
    end += 1;
  }
  return {token: {kind: 'text', value: text.slice(from, end)}, next: end};
}

function parseInline(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let at = 0;
  let key = 0;
  while (at < text.length) {
    const found = nextToken(text, at);
    if (!found) {
      break;
    }
    const {token, next} = found;
    switch (token.kind) {
      case 'text':
        nodes.push(token.value);
        break;
      case 'strong':
        nodes.push(<strong key={key++}>{parseInline(token.value)}</strong>);
        break;
      case 'em':
        nodes.push(<em key={key++}>{parseInline(token.value)}</em>);
        break;
      case 'code':
        nodes.push(<code key={key++}>{token.value}</code>);
        break;
      case 'link':
        nodes.push(
          <a key={key++} href={token.href}>
            {parseInline(token.label)}
          </a>,
        );
        break;
      default:
        break;
    }
    at = next;
  }
  if (nodes.length === 1) {
    return nodes[0] as ReactNode;
  }
  return <Fragment>{nodes}</Fragment>;
}

/** One source line rendered as phrasing-only markdown nodes. */
export function sourceLine(line: string): ReactNode {
  return (
    fenceLine(line) ??
    headingLine(line) ??
    listLine(line) ??
  parseInline(line)
  );
}
