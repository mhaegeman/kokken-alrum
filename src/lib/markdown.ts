// Tiny safe markdown renderer: HTML-escapes input first, then applies a
// short list of inline patterns (bold, italic, code, autolinks, mentions)
// plus preserved line breaks. Intentionally limited — no headings, no images.

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch]);
}

export interface MentionContact {
  id: number;
  name: string;
}

export interface MarkdownOptions {
  /** Names that should be highlighted as @mentions (case-insensitive). */
  mentionNames?: string[];
  /** Contacts that should be highlighted as @mentions. The typed token
   *  is normalized (lowercased, alphanumerics-only) and compared against
   *  the same normalization of each contact's name, so `@JohnSmith`,
   *  `@john-smith`, `@john_smith` all resolve to "John Smith". */
  mentionContacts?: MentionContact[];
}

function contactHandle(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function renderMarkdown(input: string, options: MarkdownOptions = {}): string {
  let html = escapeHtml(input);

  // Inline code first so * and _ inside it aren't formatted.
  // Use a placeholder so subsequent passes don't touch it.
  const codeBlocks: string[] = [];
  html = html.replace(/`([^`\n]+)`/g, (_, code) => {
    codeBlocks.push(`<code>${code}</code>`);
    return ` ${codeBlocks.length - 1} `;
  });

  // @mentions — wrap recognized user names + contacts in a styled span.
  // Match @<word> globally; if the word matches a known user display name
  // we render a user mention, otherwise we try contacts (matched on a
  // normalized handle). If neither matches we leave the text alone.
  const userKnownLower = new Set(
    (options.mentionNames ?? []).map((n) => n.toLowerCase()),
  );
  const contactsByHandle = new Map<string, MentionContact>();
  for (const c of options.mentionContacts ?? []) {
    const h = contactHandle(c.name);
    if (h) contactsByHandle.set(h, c);
  }

  if (userKnownLower.size > 0 || contactsByHandle.size > 0) {
    html = html.replace(
      /(^|[^\w@])@([A-Za-z][A-Za-z0-9_-]*)\b/g,
      (whole, prefix: string, name: string) => {
        const lower = name.toLowerCase();
        if (userKnownLower.has(lower)) {
          return `${prefix}<span class="mention" data-name="${lower}">@${name}</span>`;
        }
        const contact = contactsByHandle.get(contactHandle(name));
        if (contact) {
          return `${prefix}<span class="mention mention-contact" data-contact-id="${contact.id}">@${escapeHtml(contact.name)}</span>`;
        }
        return whole;
      },
    );
  }

  // Autolink http(s) URLs. Trailing punctuation is left out of the link.
  html = html.replace(
    /(https?:\/\/[^\s<]+?)([.,;:!?)\]]?(?:\s|$))/g,
    (_, url: string, tail: string) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${tail}`,
  );

  // Bold then italic. Bold first so `**a**` doesn't get italic-eaten.
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>');

  // Restore inline code.
  html = html.replace(/ (\d+) /g, (_, idx) => codeBlocks[+idx]);

  // Preserve line breaks.
  html = html.replace(/\n/g, '<br>');

  return html;
}
