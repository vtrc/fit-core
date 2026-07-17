import { Injectable } from '@angular/core';
import { marked } from 'marked';

@Injectable({ providedIn: 'root' })
export class MarkdownRenderer {
  renderMarkdown(markdown: string): string {
    const html = marked.parse(markdown, {
    async: false,
    breaks: true,
  });

  return html;
  }
} 