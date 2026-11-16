import type {ReactNode} from 'react';

import type {BlockContent, Definition, LinkReference, ListItem, PhrasingContent, Root} from 'mdast';

type SourcePosition = NonNullable<Root['position']>;

import {Fragment} from 'react';
import {remark} from 'remark';
import {visit} from 'unist-util-visit';

export type PaintedSourceLine = {
  paint: ReactNode | undefined;
  /** 1-based source line in this fragment that remark mapped this place onto */
  placeAt: number | undefined;
};

function placeEndLine(position: SourcePosition): number {
  return position.end.column === 1 ? position.end.line - 1 : position.end.line;
}

function lineInPlace(position: SourcePosition | undefined, line: number): boolean {
  if (!position) {
    return false;
  }
  return position.start.line <= line && line <= placeEndLine(position);
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
  return <span>{matched[2]}</span>;
}

function listMarker(line: string): string {
  const matched = /^(\s*(?:[-*+]|\d+\.)\s+)/.exec(line);
  return matched?.[1] ?? '';
}

function lineContentAfterListMarker(line: string): string {
  const body = sourceLineBody(line);
  const matched = /^(\s*(?:[-*+]|\d+\.)\s+)([\s\S]*)$/.exec(body);
  return matched?.[2] ?? body;
}

function sourceLineBody(line: string): string {
  const indent = /^(\s*)/.exec(line)?.[1] ?? '';
  let rest = line.slice(indent.length);
  while (/^>\s?/.test(rest)) {
    rest = rest.replace(/^>\s?/, '');
  }
  return `${indent}${rest}`;
}

function blockSpan(item: CoveredBlock): number {
  const position = item.position!;
  return placeEndLine(position) - position.start.line;
}

type CoveredBlock = BlockContent | ListItem | Definition;

const blockPriority = ['code', 'definition', 'listItem', 'paragraph', 'heading'] as const;

function definitionsOf(tree: Root): Map<string, string> {
  const out = new Map<string, string>();
  visit(tree, node => {
    if (node.type === 'definition') {
      out.set(node.identifier, node.url);
    }
  });
  return out;
}

function blockCoveringLine(tree: Root, line: number): CoveredBlock | undefined {
  let hits: CoveredBlock[] = [];
  visit(tree, node => {
    if (!('position' in node) || !node.position || !lineInPlace(node.position, line)) {
      return;
    }
    if (
      node.type === 'listItem' ||
      node.type === 'heading' ||
      node.type === 'code' ||
      node.type === 'paragraph' ||
      node.type === 'definition'
    ) {
      hits.push(node as CoveredBlock);
    }
  });
  if (hits.some(item => item.type === 'listItem')) {
    hits = hits.filter(item => item.type !== 'paragraph');
  }
  let best: CoveredBlock | undefined;
  for (const hit of hits) {
    if (!best) {
      best = hit;
      continue;
    }
    const span = blockSpan(hit);
    const bestSpan = blockSpan(best);
    if (span < bestSpan) {
      best = hit;
      continue;
    }
    if (span > bestSpan) {
      continue;
    }
    const hitPriority = blockPriority.indexOf(hit.type as (typeof blockPriority)[number]);
    const bestPriority = blockPriority.indexOf(best.type as (typeof blockPriority)[number]);
    if (hitPriority >= 0 && (bestPriority < 0 || hitPriority < bestPriority)) {
      best = hit;
    }
  }
  return best;
}

function phrasingNode(
  node: PhrasingContent,
  key: number,
  definitions: ReadonlyMap<string, string>,
): ReactNode {
  switch (node.type) {
    case 'text':
      return node.value;
    case 'emphasis':
      return (
        <em key={key}>
          {node.children.map((child, index) => phrasingNode(child, index, definitions))}
        </em>
      );
    case 'strong':
      return (
        <strong key={key}>
          {node.children.map((child, index) => phrasingNode(child, index, definitions))}
        </strong>
      );
    case 'inlineCode':
      return <code key={key}>{node.value}</code>;
    case 'link':
      return (
        <a key={key} href={node.url}>
          {node.children.map((child, index) => phrasingNode(child, index, definitions))}
        </a>
      );
    case 'linkReference': {
      const href = definitions.get(node.identifier) ?? '';
      return (
        <a key={key} href={href}>
          {node.children.map((child, index) => phrasingNode(child, index, definitions))}
        </a>
      );
    }
    case 'delete':
    case 'break':
      return null;
    default:
      return null;
  }
}

function phrasingChildren(children: PhrasingContent[], definitions: ReadonlyMap<string, string>): ReactNode {
  return children.map((child, index) => (
    <Fragment key={index}>{phrasingNode(child, index, definitions)}</Fragment>
  ));
}

function phrasingFromBlock(block: CoveredBlock): PhrasingContent[] {
  switch (block.type) {
    case 'listItem': {
      const phrasing: PhrasingContent[] = [];
      for (const child of block.children) {
        if (child.type === 'paragraph') {
          phrasing.push(...child.children);
        }
        if (child.type === 'blockquote') {
          for (const nested of child.children) {
            if (nested.type === 'paragraph') {
              phrasing.push(...nested.children);
            }
          }
        }
      }
      return phrasing;
    }
    case 'heading':
    case 'paragraph':
      return block.children;
    case 'definition':
      return [];
    default:
      return [];
  }
}

function textOnSourceLine(node: PhrasingContent & {type: 'text'}, line: number, rawLine: string): PhrasingContent | undefined {
  const position = node.position;
  if (!position || !lineInPlace(position, line)) {
    return undefined;
  }
  if (position.start.line === line && position.end.line === line) {
    return node;
  }
  const parts = node.value.split('\n');
  const index = line - position.start.line;
  if (index < 0 || index >= parts.length) {
    const trimmed = sourceLineBody(rawLine).trimEnd();
    return trimmed ? {type: 'text', value: trimmed, position} : undefined;
  }
  const slice = parts[index] ?? '';
  return slice ? {type: 'text', value: slice, position} : undefined;
}

function linkReferenceLeadOnLine(node: LinkReference, line: number, rawLine: string): PhrasingContent | undefined {
  const position = node.position;
  if (!position || line !== position.start.line || line === position.end.line) {
    return undefined;
  }
  const text = node.children.find(item => item.type === 'text');
  if (!text || text.type !== 'text') {
    return undefined;
  }
  const sliced = textOnSourceLine(text, line, rawLine);
  if (!sliced || sliced.type !== 'text') {
    return undefined;
  }
  return sliced;
}

function phrasingOnSourceLine(
  children: PhrasingContent[],
  line: number,
  rawLine: string,
  definitions: ReadonlyMap<string, string>,
): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  for (const child of children) {
    if (child.type === 'text') {
      const sliced = textOnSourceLine(child, line, rawLine);
      if (sliced) {
        out.push(sliced);
      }
      continue;
    }
    if (!child.position || !lineInPlace(child.position, line)) {
      continue;
    }
    if (child.type === 'linkReference') {
      const lead = linkReferenceLeadOnLine(child, line, rawLine);
      if (lead) {
        out.push(lead);
        continue;
      }
      const nested = phrasingOnSourceLine(child.children as PhrasingContent[], line, rawLine, definitions);
      if (nested.length) {
        out.push({...child, children: nested});
      }
      continue;
    }
    if (child.type === 'emphasis' || child.type === 'strong' || child.type === 'link') {
      const nested = phrasingOnSourceLine(child.children as PhrasingContent[], line, rawLine, definitions);
      if (nested.length) {
        out.push({...child, children: nested} as PhrasingContent);
      }
      continue;
    }
    out.push(child);
  }
  return out;
}

function fenceTrimmed(rawLine: string): string {
  return sourceLineBody(rawLine).trim();
}

function opensWithFenceOnLine(rawLine: string): boolean {
  return opensWithFence(lineContentAfterListMarker(rawLine));
}

function fenceMarkerRun(rawLine: string): string | undefined {
  const trimmed = fenceTrimmed(rawLine);
  return /^(`+|~+)/.exec(trimmed)?.[1];
}

function fenceMarkerLength(rawLine: string): number {
  return fenceMarkerRun(rawLine)?.length ?? 0;
}

function opensWithFence(rawLine: string): boolean {
  return fenceMarkerLength(rawLine) >= 3;
}

function fenceMarkerChar(rawLine: string): '`' | '~' | undefined {
  const run = fenceMarkerRun(rawLine);
  if (!run) {
    return undefined;
  }
  return run[0] === '~' ? '~' : '`';
}

function closesFenceAt(rawLine: string, openLength: number, openChar: '`' | '~'): boolean {
  const trimmed = fenceTrimmed(rawLine);
  const run = fenceMarkerRun(rawLine);
  if (!run || run.length < openLength || run[0] !== openChar) {
    return false;
  }
  return trimmed.slice(run.length).trim() === '';
}

function openFenceOnBlock(
  texts: readonly string[],
  block: BlockContent & {type: 'code'},
): {length: number; char: '`' | '~'} | undefined {
  const start = block.position?.start.line;
  if (!start) {
    return undefined;
  }
  const content = lineContentAfterListMarker(texts[start - 1] ?? '');
  const run = fenceMarkerRun(content);
  const char = fenceMarkerChar(content);
  if (!run || !char || run.length < 3) {
    return undefined;
  }
  return {length: run.length, char};
}

function codeBlockOpensWithFence(texts: readonly string[], block: BlockContent & {type: 'code'}): boolean {
  const start = block.position?.start.line;
  if (!start) {
    return false;
  }
  const raw = texts[start - 1] ?? '';
  const content = lineContentAfterListMarker(raw);
  if (!opensWithFence(content)) {
    return false;
  }
  const indent = /^(\s*)/.exec(content)?.[1] ?? '';
  if (indent.length <= 3) {
    return true;
  }
  return codeBlockClosesWithFence(texts, block);
}

function codeBlockClosesWithFence(texts: readonly string[], block: BlockContent & {type: 'code'}): boolean {
  const start = block.position?.start.line;
  const end = block.position?.end.line;
  const open = openFenceOnBlock(texts, block);
  if (!start || !end || !open) {
    return false;
  }
  for (let line = start + 1; line <= end; line += 1) {
    if (closesFenceAt(texts[line - 1] ?? '', open.length, open.char)) {
      return true;
    }
  }
  return false;
}

function codeLineText(
  block: BlockContent & {type: 'code'},
  line: number,
  rawLine: string,
  texts: readonly string[],
): string {
  const valueLines = block.value.split('\n');
  const start = block.position!.start.line;
  const fenced = codeBlockOpensWithFence(texts, block);
  const closedFence = fenced && codeBlockClosesWithFence(texts, block);
  const open = openFenceOnBlock(texts, block);
  if (fenced) {
    if (line === start && opensWithFenceOnLine(rawLine)) {
      return '';
    }
    if (closedFence && open && closesFenceAt(rawLine, open.length, open.char)) {
      return '';
    }
    const index = line - start - 1;
    if (index >= 0 && index < valueLines.length) {
      return valueLines[index] ?? '';
    }
    return '';
  }
  const index = line - start;
  if (index >= 0 && index < valueLines.length) {
    return valueLines[index] ?? sourceLineBody(rawLine);
  }
  return sourceLineBody(rawLine);
}

function paintBlockSlice(
  block: CoveredBlock,
  line: number,
  rawLine: string,
  texts: readonly string[],
  definitions: ReadonlyMap<string, string>,
): ReactNode | undefined {
  if (!block.position) {
    return undefined;
  }
  if (!lineInPlace(block.position, line)) {
    return undefined;
  }
  if (block.type === 'definition') {
    return undefined;
  }
  if (block.type === 'code') {
    return <code>{codeLineText(block, line, rawLine, texts)}</code>;
  }
  const phrasing = phrasingOnSourceLine(phrasingFromBlock(block), line, rawLine, definitions);
  if (block.type === 'listItem' && line === block.position.start.line) {
    return (
      <span>
        {listMarker(rawLine)}
        {phrasingChildren(phrasing, definitions)}
      </span>
    );
  }
  if (phrasing.length === 0) {
    return undefined;
  }
  if (block.type === 'heading') {
    return <span>{phrasingChildren(phrasing, definitions)}</span>;
  }
  return phrasingChildren(phrasing, definitions);
}

function paintOneLine(
  tree: Root,
  lineIndex: number,
  rawLine: string,
  texts: readonly string[],
  definitions: ReadonlyMap<string, string>,
): PaintedSourceLine {
  const lineNum = lineIndex + 1;
  const block = blockCoveringLine(tree, lineNum);
  if (block?.position && lineInPlace(block.position, lineNum)) {
    return {
      paint: paintBlockSlice(block, lineNum, rawLine, texts, definitions),
      placeAt: lineNum,
    };
  }
  const lifted = headingLine(rawLine);
  if (lifted) {
    return {paint: lifted, placeAt: undefined};
  }
  const trimmed = rawLine.trimEnd();
  if (trimmed) {
    return {paint: trimmed, placeAt: undefined};
  }
  return {paint: undefined, placeAt: undefined};
}

/** The spine lines of one document, painted as nodes in that single markdown document. */
export function paintSourceDocument(texts: readonly string[]): PaintedSourceLine[] {
  const source = texts.join('\n');
  const tree = remark().parse(source) as Root;
  const definitions = definitionsOf(tree);
  return texts.map((text, index) => paintOneLine(tree, index, text, texts, definitions));
}