import type {ReactNode} from 'react';

import type {BlockContent, Definition, LinkReference, ListItem, PhrasingContent, Root, TableRow} from 'mdast';

type SourcePosition = NonNullable<Root['position']>;

import {Fragment} from 'react';
import {remark} from 'remark';
import remarkGfm from 'remark-gfm';
import {visit} from 'unist-util-visit';

import {Diagram} from './diagram.tsx';

export type PaintedSourceLine = {
  paint: ReactNode | undefined;
  /** 1-based source line in this fragment that remark mapped this place onto */
  placeAt: number | undefined;
  /** A later line of a mermaid fence. The opening line holds the diagram. */
  hide?: boolean;
};

export type PaintSourceOptions = {
  /** List rows show item body only, without source list marker characters. */
  listTextOnly?: boolean;
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
  return <span className={`hd hd-${marks}`}>{matched[2]}</span>;
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

type CoveredBlock = BlockContent | ListItem | Definition | TableRow;

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
      node.type === 'definition' ||
      node.type === 'table' ||
      node.type === 'tableRow'
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
      return (
        <del key={key}>
          {node.children.map((child, index) => phrasingNode(child, index, definitions))}
        </del>
      );
    case 'footnoteReference':
      return <sup key={key}>{node.label ?? node.identifier}</sup>;
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
    if (
      child.type === 'emphasis' ||
      child.type === 'strong' ||
      child.type === 'link' ||
      child.type === 'delete'
    ) {
      const nested = phrasingOnSourceLine(child.children as PhrasingContent[], line, rawLine, definitions);
      if (nested.length) {
        out.push({...child, children: nested} as PhrasingContent);
      }
      continue;
    }
    if (child.type === 'inlineCode') {
      if (line !== placeEndLine(child.position)) {
        continue;
      }
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

function isIndentedCodeBlockIndent(indent: string): boolean {
  if (indent.includes('\t')) {
    return true;
  }
  return indent.length >= 4;
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

function codeBlockValueOpensWithFence(
  block: BlockContent & {type: 'code'},
  openLength: number,
  openChar: '`' | '~',
): boolean {
  const first = (block.value.split('\n')[0] ?? '').trim();
  const run = /^(`+|~+)/.exec(first)?.[1];
  if (!run || run[0] !== openChar || run.length < openLength) {
    return false;
  }
  return true;
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
  const open = openFenceOnBlock(texts, block);
  if (!open) {
    return false;
  }
  const indent = /^(\s*)/.exec(content)?.[1] ?? '';
  if (!isIndentedCodeBlockIndent(indent)) {
    return true;
  }
  return !codeBlockValueOpensWithFence(block, open.length, open.char);
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
  options?: PaintSourceOptions,
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
    const text = codeLineText(block, line, rawLine, texts);
    return options?.listTextOnly ? <code className="src">{text}</code> : <code>{text}</code>;
  }
  const phrasing = phrasingOnSourceLine(phrasingFromBlock(block), line, rawLine, definitions);
  if (block.type === 'listItem' && line === block.position.start.line) {
    if (options?.listTextOnly) {
      return phrasing.length === 0 ? undefined : (
        <span className="item">{phrasingChildren(phrasing, definitions)}</span>
      );
    }
  }
  if (block.type === 'tableRow') {
    return (
      <span>
        {block.children.map((cell, index) => (
          <span className="cell" key={index}>
            {phrasingChildren(phrasingOnSourceLine(cell.children, line, rawLine, definitions), definitions)}
          </span>
        ))}
      </span>
    );
  }
  if (block.type === 'table') {
    return undefined;
  }
  if (block.type === 'listItem' && line === block.position.start.line) {
    const task = block.checked;
    return (
      <span>
        {typeof task === 'boolean' ? (
          <span className={task ? 'box is-on' : 'box'} data-checked={task ? 'true' : 'false'} />
        ) : (
          listMarker(rawLine)
        )}
        {phrasingChildren(phrasing, definitions)}
      </span>
    );
  }
  if (phrasing.length === 0) {
    return undefined;
  }
  if (block.type === 'heading') {
    return <span className={`hd hd-${block.depth}`}>{phrasingChildren(phrasing, definitions)}</span>;
  }
  return phrasingChildren(phrasing, definitions);
}

function paintOneLine(
  tree: Root,
  lineIndex: number,
  rawLine: string,
  texts: readonly string[],
  definitions: ReadonlyMap<string, string>,
  options?: PaintSourceOptions,
): PaintedSourceLine {
  const lineNum = lineIndex + 1;
  const block = blockCoveringLine(tree, lineNum);
  if (
    block?.type === 'code' &&
    block.lang?.toLowerCase() === 'mermaid' &&
    block.position &&
    lineInPlace(block.position, lineNum)
  ) {
    if (lineNum === block.position.start.line) {
      return {paint: <Diagram chart={block.value.replace(/\n$/, '')} />, placeAt: lineNum};
    }
    return {paint: undefined, placeAt: lineNum, hide: true};
  }
  if (block?.position && lineInPlace(block.position, lineNum)) {
    return {
      paint: paintBlockSlice(block, lineNum, rawLine, texts, definitions, options),
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

export function focusProseSourceTree(lines: readonly string[]): Root {
  return remark().use(remarkGfm).parse(lines.join('\n')) as Root;
}

function listItemCoveringLine(tree: Root, line: number): ListItem | undefined {
  let item: ListItem | undefined;
  visit(tree, node => {
    if (node.type === 'listItem' && node.position && lineInPlace(node.position, line)) {
      item = node;
    }
  });
  return item;
}

export function focusProseMultiLineListJumpLine(
  tree: Root,
  lineIndex: number,
  lines: readonly string[],
): {active: boolean; listMarker: string; headingMarker: string} {
  const lineNum = lineIndex + 1;
  const block = listItemCoveringLine(tree, lineNum);
  if (block?.position === undefined) {
    return {active: false, listMarker: '', headingMarker: ''};
  }
  const multi = placeEndLine(block.position) > block.position.start.line;
  if (!multi) {
    return {active: false, listMarker: '', headingMarker: ''};
  }
  const itemStartIndex = block.position.start.line - 1;
  const listMarkerText = listMarker(lines[itemStartIndex] ?? '');
  let headingMarker = '';
  visit(tree, node => {
    if (node.type === 'heading' && node.position?.start.line === lineNum) {
      headingMarker = `${'#'.repeat(node.depth)} `;
    }
  });
  return {active: true, listMarker: listMarkerText, headingMarker};
}

/** First line index of a multi-line list item when the jump sits on a later line of that item. */
export function focusProseMultiLineListJumpPaintStart(tree: Root, lineIndex: number): number | undefined {
  const lineNum = lineIndex + 1;
  const block = listItemCoveringLine(tree, lineNum);
  if (block?.position === undefined) {
    return undefined;
  }
  const multi = placeEndLine(block.position) > block.position.start.line;
  const itemStart = block.position.start.line - 1;
  if (!multi || lineIndex === itemStart) {
    return undefined;
  }
  return itemStart;
}

/** Last zero-based line index of the list item that covers this line. */
export function focusProseMultiLineListItemEnd(tree: Root, lineIndex: number): number | undefined {
  const lineNum = lineIndex + 1;
  const block = listItemCoveringLine(tree, lineNum);
  if (block?.position === undefined) {
    return undefined;
  }
  return placeEndLine(block.position) - 1;
}

/** Last line index when the jump sits on the first line of a multi-line list item. */
export function focusProseMultiLineListJumpPaintEnd(tree: Root, lineIndex: number): number | undefined {
  const lineNum = lineIndex + 1;
  const block = listItemCoveringLine(tree, lineNum);
  if (block?.position === undefined) {
    return undefined;
  }
  const multi = placeEndLine(block.position) > block.position.start.line;
  const itemStart = block.position.start.line - 1;
  if (!multi || lineIndex !== itemStart) {
    return undefined;
  }
  return placeEndLine(block.position) - 1;
}

/** The spine lines of one document, painted as nodes in that single markdown document. */
export function paintSourceDocument(
  texts: readonly string[],
  options?: PaintSourceOptions,
): PaintedSourceLine[] {
  const source = texts.join('\n');
  const tree = remark().use(remarkGfm).parse(source) as Root;
  const definitions = definitionsOf(tree);
  return texts.map((text, index) => paintOneLine(tree, index, text, texts, definitions, options));
}