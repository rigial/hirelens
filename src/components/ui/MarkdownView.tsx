import React from 'react';
import { cn } from '../../lib/utils';
import { FileText } from 'lucide-react';

interface MarkdownViewProps {
  content: string;
  className?: string;
  placeholder?: string;
}

/**
 * Format inline markdown elements (bold, italic, strikethrough, inline code, links)
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Regex to match inline tokens:
  // 1. Links: [text](url)
  // 2. Bold+Italic: ***text*** or ___text___
  // 3. Bold: **text** or __text__
  // 4. Italic: *text* or _text_
  // 5. Strikethrough: ~~text~~
  // 6. Inline code: `code`
  const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      nodes.push(text.substring(lastIndex, match.index));
    }

    const [fullMatch] = match;

    if (fullMatch.startsWith('[') && fullMatch.includes('](')) {
      // Link [text](url)
      const linkText = match[2];
      const linkUrl = match[3];
      nodes.push(
        <a
          key={match.index}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-800 underline font-medium"
        >
          {linkText}
        </a>
      );
    } else if (match[4]) {
      // Bold + Italic ***text***
      nodes.push(
        <strong key={match.index} className="font-bold italic text-slate-900">
          {match[4]}
        </strong>
      );
    } else if (match[5] || match[6]) {
      // Bold **text** or __text__
      nodes.push(
        <strong key={match.index} className="font-semibold text-slate-900">
          {match[5] || match[6]}
        </strong>
      );
    } else if (match[7]) {
      // Strikethrough ~~text~~
      nodes.push(
        <del key={match.index} className="line-through text-slate-400">
          {match[7]}
        </del>
      );
    } else if (match[8]) {
      // Inline code `code`
      nodes.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[0.9em] border border-slate-200/80"
        >
          {match[8]}
        </code>
      );
    } else if (match[9] || match[10]) {
      // Italic *text* or _text_
      nodes.push(
        <em key={match.index} className="italic text-slate-800">
          {match[9] || match[10]}
        </em>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.substring(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

export function MarkdownView({
  content,
  className,
  placeholder = 'Nothing to preview yet. Switch to Write mode to enter the job description.',
}: MarkdownViewProps) {
  if (!content || !content.trim()) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center p-8 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-lg text-slate-400 min-h-[160px]',
          className
        )}
      >
        <FileText className="h-6 w-6 text-slate-300 mb-2" />
        <p className="text-xs">{placeholder}</p>
      </div>
    );
  }

  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];

  let i = 0;
  let elementKey = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code Block (``` ... ```)
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      elements.push(
        <div key={elementKey++} className="my-3 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 text-slate-100 font-mono text-xs">
          {language && (
            <div className="bg-slate-950 px-3 py-1 text-[10px] uppercase text-slate-400 font-medium border-b border-slate-800">
              {language}
            </div>
          )}
          <pre className="p-3 overflow-x-auto leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 2. Horizontal Rule (---, ***, ___)
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(<hr key={elementKey++} className="my-4 border-slate-200" />);
      i++;
      continue;
    }

    // 3. Headings (#, ##, ###, ####, #####, ######)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const inline = renderInlineMarkdown(headingText);

      switch (level) {
        case 1:
          elements.push(
            <h1 key={elementKey++} className="text-xl font-bold text-slate-900 mt-4 mb-2 pb-1 border-b border-slate-200">
              {inline}
            </h1>
          );
          break;
        case 2:
          elements.push(
            <h2 key={elementKey++} className="text-lg font-bold text-slate-900 mt-3.5 mb-1.5 pb-0.5 border-b border-slate-100">
              {inline}
            </h2>
          );
          break;
        case 3:
          elements.push(
            <h3 key={elementKey++} className="text-base font-semibold text-slate-900 mt-3 mb-1">
              {inline}
            </h3>
          );
          break;
        case 4:
          elements.push(
            <h4 key={elementKey++} className="text-sm font-semibold text-slate-800 mt-2.5 mb-1">
              {inline}
            </h4>
          );
          break;
        default:
          elements.push(
            <h5 key={elementKey++} className="text-xs font-semibold text-slate-800 uppercase tracking-wide mt-2 mb-1">
              {inline}
            </h5>
          );
          break;
      }
      i++;
      continue;
    }

    // 4. Blockquote (> ...)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <blockquote
          key={elementKey++}
          className="my-3 pl-3.5 border-l-4 border-indigo-400 bg-indigo-50/40 py-2 pr-3 rounded-r text-xs text-slate-700 italic"
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx} className={qIdx > 0 ? 'mt-1.5' : ''}>
              {renderInlineMarkdown(ql)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // 5. Unordered List (- , * , + ) or Task List (- [ ] / - [x])
    if (/^[-*+]\s+/.test(trimmed)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        const itemLine = lines[i].trim();
        const rawContent = itemLine.replace(/^[-*+]\s+/, '');

        // Checkbox item
        if (/^\[([ xX])\]\s+/.test(rawContent)) {
          const checked = rawContent.startsWith('[x]') || rawContent.startsWith('[X]');
          const textAfterCheckbox = rawContent.replace(/^\[([ xX])\]\s+/, '');
          listItems.push(
            <li key={listItems.length} className="flex items-start gap-2 list-none my-1">
              <input
                type="checkbox"
                checked={checked}
                readOnly
                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-default"
              />
              <span className={checked ? 'line-through text-slate-400' : 'text-slate-700'}>
                {renderInlineMarkdown(textAfterCheckbox)}
              </span>
            </li>
          );
        } else {
          listItems.push(
            <li key={listItems.length} className="my-0.5 text-slate-700">
              {renderInlineMarkdown(rawContent)}
            </li>
          );
        }
        i++;
      }

      elements.push(
        <ul key={elementKey++} className="my-2 pl-5 list-disc space-y-0.5 text-xs text-slate-700">
          {listItems}
        </ul>
      );
      continue;
    }

    // 6. Ordered List (1. , 2. )
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const rawContent = lines[i].trim().replace(/^\d+\.\s+/, '');
        listItems.push(
          <li key={listItems.length} className="my-0.5 text-slate-700">
            {renderInlineMarkdown(rawContent)}
          </li>
        );
        i++;
      }

      elements.push(
        <ol key={elementKey++} className="my-2 pl-5 list-decimal space-y-0.5 text-xs text-slate-700">
          {listItems}
        </ol>
      );
      continue;
    }

    // 7. Blank line
    if (!trimmed) {
      i++;
      continue;
    }

    // 8. Regular Paragraph (group consecutive non-empty lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^(\-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      elements.push(
        <p key={elementKey++} className="my-2 text-xs text-slate-700 leading-relaxed break-words">
          {paraLines.map((pl, plIdx) => (
            <React.Fragment key={plIdx}>
              {plIdx > 0 && <br />}
              {renderInlineMarkdown(pl)}
            </React.Fragment>
          ))}
        </p>
      );
    }
  }

  return (
    <div
      className={cn(
        'prose-sm max-w-none text-slate-800 rounded-lg p-4 bg-white border border-slate-200 overflow-y-auto leading-normal',
        className
      )}
    >
      {elements}
    </div>
  );
}
