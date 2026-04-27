import { useEffect, useMemo, useRef, useState } from 'react';

// One thing the user can be mentioning. `handle` is what we type after `@`
// — always lowercase, alphanumerics-only — and is what markdown.ts looks
// up when rendering. `label` is the human-friendly name shown in the menu.
export interface MentionItem {
  kind: 'user' | 'contact';
  label: string;
  handle: string;
  id?: string | number;
}

// Builds a `MentionItem[]` from the project's user profiles + contacts.
// Filters out anything without a usable handle (e.g. blank display names).
// `selfId` is filtered out so users don't waste time mentioning themselves
// — the mentions bell only shows mentions *of* you, so self-mentions are
// noise.
export function buildMentionItems({
  users,
  contacts,
  selfId,
}: {
  users: { id: string; display_name: string }[];
  contacts: { id: number; name: string }[];
  selfId?: string | null;
}): MentionItem[] {
  const items: MentionItem[] = [];
  for (const u of users) {
    if (selfId && u.id === selfId) continue;
    const handle = normalizeHandle(u.display_name);
    if (!handle) continue;
    items.push({ kind: 'user', label: u.display_name, handle, id: u.id });
  }
  for (const c of contacts) {
    const handle = normalizeHandle(c.name);
    if (!handle) continue;
    items.push({ kind: 'contact', label: c.name, handle, id: c.id });
  }
  return items;
}

function normalizeHandle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface ActiveToken {
  start: number;
  end: number;
  query: string;
}

// Locates the @-token the caret is currently inside, if any. Returns null
// if there's no active mention (caret not in a token, token preceded by a
// non-whitespace char, token contains whitespace, etc.).
function findMentionToken(value: string, caret: number): ActiveToken | null {
  let i = caret - 1;
  while (i >= 0) {
    const ch = value[i];
    if (ch === '@') {
      const prev = i === 0 ? '' : value[i - 1];
      if (prev === '' || /\s/.test(prev)) {
        return { start: i, end: caret, query: value.slice(i + 1, caret) };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

// Case-insensitive filter. Matches if the normalized handle contains the
// normalized query, OR the human label contains the raw query string. The
// dual check means typing "an" surfaces both `@andy` and `Anders Plumbing`
// even though the latter normalizes to `andersplumbing`.
function filterMentionItems(items: MentionItem[], query: string): MentionItem[] {
  const qNorm = normalizeHandle(query);
  const qRaw = query.toLowerCase();
  if (!qNorm && !qRaw) return items.slice(0, 8);
  return items
    .filter(
      (it) =>
        (qNorm && it.handle.includes(qNorm)) ||
        (qRaw && it.label.toLowerCase().includes(qRaw)),
    )
    .slice(0, 8);
}

interface UseMentionArgs<T extends HTMLInputElement | HTMLTextAreaElement> {
  value: string;
  onChange: (next: string) => void;
  items: MentionItem[];
  inputRef: React.RefObject<T>;
}

interface UseMentionResult<T extends HTMLInputElement | HTMLTextAreaElement> {
  // Replace the input's onChange + onKeyDown with these — the hook needs to
  // intercept caret movement and Enter/Tab/Arrow keys.
  onChange: (e: React.ChangeEvent<T>) => void;
  onKeyDown: (e: React.KeyboardEvent<T>) => boolean;
  popup: React.ReactNode;
  // True when the popup is open. Useful so callers can suppress their own
  // submit-on-Enter behavior while the user is picking a mention.
  isOpen: boolean;
}

export function useMentionAutocomplete<
  T extends HTMLInputElement | HTMLTextAreaElement,
>({ value, onChange, items, inputRef }: UseMentionArgs<T>): UseMentionResult<T> {
  const [token, setToken] = useState<ActiveToken | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Remember the caret position right after the last value change so we
  // can re-detect the token on the next render (React onChange fires
  // before selectionStart updates synchronously in some browsers).
  const caretRef = useRef<number>(0);

  const filtered = useMemo(
    () => (token ? filterMentionItems(items, token.query) : []),
    [token, items],
  );

  // Keep the highlighted item in range whenever the filter changes.
  useEffect(() => {
    if (filtered.length === 0) setActiveIndex(0);
    else if (activeIndex >= filtered.length) setActiveIndex(filtered.length - 1);
  }, [filtered.length, activeIndex]);

  const isOpen = token != null && filtered.length > 0;

  const updateToken = (val: string, caret: number) => {
    caretRef.current = caret;
    const t = findMentionToken(val, caret);
    setToken(t);
    if (!t) setActiveIndex(0);
  };

  // Re-evaluate the active token whenever the user clicks / arrows around
  // (caret moves without value changing).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    function onSelect() {
      const caret = el!.selectionStart ?? 0;
      updateToken(el!.value, caret);
    }
    el.addEventListener('keyup', onSelect);
    el.addEventListener('click', onSelect);
    el.addEventListener('blur', () => setToken(null));
    return () => {
      el.removeEventListener('keyup', onSelect);
      el.removeEventListener('click', onSelect);
    };
    // inputRef is stable per parent, so this only needs to run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChangeIntercept = (e: React.ChangeEvent<T>) => {
    const next = e.target.value;
    onChange(next);
    const caret = e.target.selectionStart ?? next.length;
    updateToken(next, caret);
  };

  const insertMention = (item: MentionItem) => {
    if (!token) return;
    const before = value.slice(0, token.start);
    const after = value.slice(token.end);
    const insert = `@${item.handle}`;
    const sep = after.startsWith(' ') || after === '' ? '' : ' ';
    const next = before + insert + (after === '' ? ' ' : sep + after);
    onChange(next);
    setToken(null);
    setActiveIndex(0);
    // Restore focus + caret right after the inserted mention.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const caret = before.length + insert.length + 1;
      try {
        el.setSelectionRange(caret, caret);
      } catch {
        /* ignore — input types like number don't support setSelectionRange */
      }
    });
  };

  // Returns true when the key was handled, so the caller knows to skip its
  // own Enter-to-submit etc. behavior.
  const onKeyDown = (e: React.KeyboardEvent<T>): boolean => {
    if (!isOpen) return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) insertMention(item);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setToken(null);
      return true;
    }
    return false;
  };

  const popup = isOpen ? (
    <MentionPopup
      items={filtered}
      activeIndex={activeIndex}
      onHover={setActiveIndex}
      onSelect={insertMention}
    />
  ) : null;

  return { onChange: onChangeIntercept, onKeyDown, popup, isOpen };
}

function MentionPopup({
  items,
  activeIndex,
  onHover,
  onSelect,
}: {
  items: MentionItem[];
  activeIndex: number;
  onHover: (i: number) => void;
  onSelect: (item: MentionItem) => void;
}) {
  return (
    <div className="mention-popup" role="listbox" aria-label="Mention suggestions">
      {items.map((it, i) => (
        <button
          key={`${it.kind}-${it.id ?? it.handle}`}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          className={`mention-option ${i === activeIndex ? 'active' : ''}`}
          // Use mousedown so the click fires *before* the input loses focus.
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(it);
          }}
          onMouseEnter={() => onHover(i)}
        >
          <span className="mention-option-icon" aria-hidden="true">
            {it.kind === 'user' ? '👤' : '🤝'}
          </span>
          <span className="mention-option-label">{it.label}</span>
          <span className="mention-option-handle">@{it.handle}</span>
        </button>
      ))}
    </div>
  );
}
