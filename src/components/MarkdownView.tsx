import { useMemo } from 'react';
import { renderMarkdown } from '../utils/markdown';

export function MarkdownView({ markdown, className = '' }: { markdown: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);
  if (!markdown.trim()) return null;
  return <div className={`markdown ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
