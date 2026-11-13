import type {ReactNode} from 'react';

import type {BlockContent, ListItem, PhrasingContent, Root} from 'mdast';

import {Fragment} from 'react';
import {remark} from 'remark';
import {visit} from 'unist-util-visit';

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
  return <span>{matched[2]}</span>;
}

function listMarker(line: string): string {
  const matched = /^(\s*(?:[-*+]|\d+\.)\s+)/.exec(line);
  return matched?.[1] ?? '';
}

function blockOnLine(tree: Root, line: number): BlockContent | ListItem | undefined {
  const hits: (BlockContent | ListItem)[] = [];
  visit(tree, node => {
    if (!('position' in node) || !node.position || node.position.start.line !== line) {
      return;
    }
    if (
      node.type === 'listItem' ||
      node.type === 'heading' ||
      node.type === 'code' ||
      node.type === 'paragraph'
    ) {
      hits.push(node as BlockContent | ListItem);
    }
  });
  return (
    hits.find(item => item.type === 'listItem') ??
    hits.find(item => item.type === 'heading') ??
    hits.find(item => item.type === 'code') ??
    hits.find(item => item.type === 'paragraph')
  );
}

function phrasingNode(node: PhrasingContent, key: number): ReactNode {
  switch (node.type) {
    case 'text':
      return node.value;
    case 'emphasis':
      return <em key={key}>{node.children.map((child, index) => phrasingNode(child, index))}</em>;
    case 'strong':
      return <strong key={key}>{node.children.map((child, index) => phrasingNode(child, index))}</strong>;
    case 'inlineCode':
      return <code key={key}>{node.value}</code>;
    case 'link':
      return (
        <a key={key} href={node.url}>
          {node.children.map((child, index) => phrasingNode(child, index))}
        </a>
      );
    case 'delete':
    case 'break':
      return null;
    default:
      return null;
  }
}

function phrasingChildren(children: PhrasingContent[]): ReactNode {
  return children.map((child, index) => (
    <Fragment key={index}>{phrasingNode(child, index)}</Fragment>
  ));
}

function paintBlock(block: BlockContent | ListItem, rawLine: string): ReactNode {
  switch (block.type) {
    case 'listItem': {
      const phrasing: PhrasingContent[] = [];
      for (const child of block.children) {
        if (child.type === 'paragraph') {
          phrasing.push(...child.children);
        }
      }
      return (
        <span>
          {listMarker(rawLine)}
          {phrasingChildren(phrasing)}
        </span>
      );
    }
    case 'heading':
      return <span>{phrasingChildren(block.children)}</span>;
    case 'paragraph':
      return phrasingChildren(block.children);
    case 'code':
      return <code>{block.value}</code>;
    default:
      return rawLine.trimEnd();
  }
}

function paintOneLine(tree: Root, lineIndex: number, rawLine: string): ReactNode | undefined {
  const fence = fenceLine(rawLine);
  if (fence) {
    return fence;
  }
  const block = blockOnLine(tree, lineIndex + 1);
  if (block) {
    return paintBlock(block, rawLine);
  }
  const lifted = headingLine(rawLine);
  if (lifted) {
    return lifted;
  }
  return rawLine.trimEnd() ? rawLine.trimEnd() : undefined;
}

/** The spine lines of one document, painted as nodes in that single markdown document. */
export function paintSourceDocument(texts: readonly string[]): (ReactNode | undefined)[] {
  const source = texts.join('\n');
  const tree = remark().parse(source) as Root;
  return texts.map((text, index) => paintOneLine(tree, index, text));
}
