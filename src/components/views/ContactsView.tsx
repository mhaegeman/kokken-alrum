import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import type { Contact } from '../../types';
import { confirm } from '../../lib/confirm';

interface Props {
  currentUserId: string | null;
  selectedContactId: number | null;
  onSelectContact: (id: number | null) => void;
  isGuest: boolean;
}

type DraftContact = Omit<Contact, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;

const EMPTY_DRAFT: DraftContact = {
  name: '',
  role: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
};

export function ContactsView({
  currentUserId,
  selectedContactId,
  onSelectContact,
  isGuest,
}: Props) {
  const contacts = useStore((s) => s.state.contacts);
  const addContact = useStore((s) => s.addContact);
  const updateContact = useStore((s) => s.updateContact);
  const deleteContact = useStore((s) => s.deleteContact);

  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => a.name.localeCompare(b.name)),
    [contacts],
  );

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedContacts;
    return sortedContacts.filter((c) =>
      [c.name, c.role, c.phone, c.email, c.address, c.notes]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [sortedContacts, search]);

  // Auto-select the first contact on desktop only. On mobile the layout
  // shows either the list or one detail pane (the back arrow toggles
  // between them); auto-selecting would skip past the list and break
  // back since the effect would immediately re-select after the back
  // tap cleared the selection.
  useEffect(() => {
    const isMobile =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 720px)').matches;
    if (
      !isMobile &&
      selectedContactId == null &&
      filteredContacts.length > 0 &&
      !adding
    ) {
      onSelectContact(filteredContacts[0].id);
    }
    if (
      selectedContactId != null &&
      !contacts.find((c) => c.id === selectedContactId)
    ) {
      onSelectContact(null);
    }
  }, [filteredContacts, contacts, selectedContactId, adding, onSelectContact]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) ?? null,
    [contacts, selectedContactId],
  );

  const onCreate = async (draft: DraftContact) => {
    if (!currentUserId) return;
    const id = await addContact(draft, currentUserId);
    if (id != null) {
      setAdding(false);
      onSelectContact(id);
    }
  };

  return (
    <div className={`contacts-wrap ${selectedContact || adding ? 'has-detail' : ''}`}>
      <ContactSidebar
        contacts={filteredContacts}
        totalCount={contacts.length}
        selectedId={selectedContactId}
        onSelect={(id) => {
          setAdding(false);
          onSelectContact(id);
        }}
        search={search}
        onSearch={setSearch}
        onNew={() => {
          setAdding(true);
          onSelectContact(null);
        }}
        canCreate={!isGuest && !!currentUserId}
      />

      <div className="contacts-main">
        {adding ? (
          <ContactForm
            mode="create"
            initial={EMPTY_DRAFT}
            onCancel={() => setAdding(false)}
            onSubmit={onCreate}
          />
        ) : selectedContact ? (
          <ContactDetail
            key={selectedContact.id}
            contact={selectedContact}
            isGuest={isGuest}
            onSave={(patch) => updateContact(selectedContact.id, patch)}
            onDelete={async () => {
              const ok = await confirm({
                title: 'Delete contact?',
                message: `"${selectedContact.name}" will be removed from the project address book.`,
                confirmLabel: 'Delete contact',
                danger: true,
              });
              if (ok) {
                deleteContact(selectedContact.id);
                onSelectContact(null);
              }
            }}
            onBack={() => onSelectContact(null)}
          />
        ) : (
          <div className="contacts-empty">
            <h3>No contact selected</h3>
            <p>
              Pick a contact on the left
              {!isGuest && ', or add a new one'}.{' '}
              {contacts.length === 0 && 'Architect, plumber, electrician…'}
            </p>
            <p className="contacts-empty-hint">
              Tip: type <code>@name</code> in any comment or notes message to
              link to a contact.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── sidebar ────────────────────────────────────────────────────

function ContactSidebar({
  contacts,
  totalCount,
  selectedId,
  onSelect,
  search,
  onSearch,
  onNew,
  canCreate,
}: {
  contacts: Contact[];
  totalCount: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  search: string;
  onSearch: (q: string) => void;
  onNew: () => void;
  canCreate: boolean;
}) {
  return (
    <aside className="contacts-sidebar">
      <div className="contacts-sidebar-head">
        <h4>Contacts</h4>
        {canCreate && (
          <button
            className="icon-btn contacts-new-btn"
            onClick={onNew}
            aria-label="New contact"
            title="New contact"
          >
            +
          </button>
        )}
      </div>

      <input
        className="contacts-search"
        type="search"
        placeholder="Search…"
        aria-label="Search contacts"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />

      <div className="contacts-list">
        {totalCount === 0 && (
          <p className="contacts-list-empty">
            No contacts yet
            {canCreate && '. Click + to add one.'}
          </p>
        )}
        {totalCount > 0 && contacts.length === 0 && (
          <p className="contacts-list-empty">No contacts match your search.</p>
        )}
        {contacts.map((c) => (
          <button
            key={c.id}
            className={`contact-row ${c.id === selectedId ? 'active' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <span className="contact-row-name">{c.name}</span>
            {c.role && <span className="contact-row-role">{c.role}</span>}
            {(c.phone || c.email) && (
              <span className="contact-row-meta">
                {c.phone || c.email}
              </span>
            )}
          </button>
        ))}
      </div>
    </aside>
  );
}

// ─── detail ─────────────────────────────────────────────────────

function ContactDetail({
  contact,
  isGuest,
  onSave,
  onDelete,
  onBack,
}: {
  contact: Contact;
  isGuest: boolean;
  onSave: (patch: Partial<Contact>) => void | Promise<void>;
  onDelete: () => void;
  onBack: () => void;
}) {
  const handle = useMemo(
    () => contact.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
    [contact.name],
  );

  if (isGuest) {
    return (
      <div className="contact-detail">
        <div className="contact-detail-head">
          <button
            className="icon-btn contacts-back-btn"
            onClick={onBack}
            aria-label="Back to list"
          >
            ←
          </button>
          <div className="contact-detail-title-wrap">
            <h2 className="contact-detail-title">{contact.name}</h2>
            {contact.role && (
              <p className="contact-detail-sub">{contact.role}</p>
            )}
          </div>
        </div>
        <div className="contact-detail-body">
          <ContactReadOnlyField label="Phone" value={contact.phone} kind="phone" />
          <ContactReadOnlyField label="Email" value={contact.email} kind="email" />
          <ContactReadOnlyField label="Address" value={contact.address} />
          <ContactReadOnlyField label="Notes" value={contact.notes} multiline />
          {handle && (
            <p className="contact-mention-hint">
              Mention in comments or notes: <code>@{handle}</code>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="contact-detail">
      <div className="contact-detail-head">
        <button
          className="icon-btn contacts-back-btn"
          onClick={onBack}
          aria-label="Back to list"
        >
          ←
        </button>
        <div className="contact-detail-title-wrap">
          <ContactInlineField
            value={contact.name}
            placeholder="Name"
            className="contact-detail-title"
            onSave={(v) => onSave({ name: v.trim() || contact.name })}
          />
          <ContactInlineField
            value={contact.role}
            placeholder="Role / company"
            className="contact-detail-sub"
            onSave={(v) => onSave({ role: v })}
          />
        </div>
        <button
          className="icon-btn danger"
          onClick={onDelete}
          title="Delete contact"
        >
          Delete
        </button>
      </div>

      <div className="contact-detail-body">
        <ContactField
          label="Phone"
          value={contact.phone}
          placeholder="+45 …"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          onSave={(v) => onSave({ phone: v })}
        />
        <ContactField
          label="Email"
          value={contact.email}
          placeholder="name@example.com"
          type="email"
          inputMode="email"
          autoComplete="email"
          onSave={(v) => onSave({ email: v })}
        />
        <ContactField
          label="Address"
          value={contact.address}
          placeholder="Street, postal code, city"
          autoComplete="street-address"
          onSave={(v) => onSave({ address: v })}
        />
        <ContactField
          label="Notes"
          value={contact.notes}
          placeholder="What they do, when they're available, anything to remember…"
          multiline
          onSave={(v) => onSave({ notes: v })}
        />

        {handle && (
          <p className="contact-mention-hint">
            Mention in comments or notes: <code>@{handle}</code>
          </p>
        )}
      </div>
    </div>
  );
}

function ContactInlineField({
  value,
  placeholder,
  className,
  onSave,
}: {
  value: string;
  placeholder: string;
  className: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft !== value) onSave(draft);
  };

  return (
    <input
      className={`contact-inline-input ${className}`}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function ContactField({
  label,
  value,
  placeholder,
  multiline,
  type = 'text',
  inputMode,
  autoComplete,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  type?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft !== value) onSave(draft);
  };

  return (
    <label className="contact-field">
      <span className="contact-field-label">{label}</span>
      {multiline ? (
        <textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          rows={3}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      ) : (
        <input
          ref={ref as React.Ref<HTMLInputElement>}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          autoCapitalize={type === 'email' ? 'off' : undefined}
          spellCheck={type === 'email' ? false : undefined}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      )}
    </label>
  );
}

function ContactReadOnlyField({
  label,
  value,
  kind,
  multiline,
}: {
  label: string;
  value: string;
  kind?: 'phone' | 'email';
  multiline?: boolean;
}) {
  if (!value) return null;
  let inner: React.ReactNode = value;
  if (kind === 'phone') {
    inner = <a href={`tel:${value.replace(/\s+/g, '')}`}>{value}</a>;
  } else if (kind === 'email') {
    inner = <a href={`mailto:${value}`}>{value}</a>;
  }
  return (
    <div className="contact-field contact-field-readonly">
      <span className="contact-field-label">{label}</span>
      <p className={multiline ? 'contact-field-readonly-multi' : ''}>{inner}</p>
    </div>
  );
}

// ─── new contact form ──────────────────────────────────────────

function ContactForm({
  initial,
  onCancel,
  onSubmit,
}: {
  mode: 'create';
  initial: DraftContact;
  onCancel: () => void;
  onSubmit: (draft: DraftContact) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<DraftContact>(initial);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const setField = <K extends keyof DraftContact>(key: K, value: DraftContact[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    const name = draft.name.trim();
    if (!name) {
      nameRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ ...draft, name });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="contact-detail">
      <div className="contact-detail-head">
        <button
          className="icon-btn contacts-back-btn"
          onClick={onCancel}
          aria-label="Cancel"
        >
          ←
        </button>
        <div className="contact-detail-title-wrap">
          <h2 className="contact-detail-title">New contact</h2>
          <p className="contact-detail-sub">Add a person or company</p>
        </div>
      </div>

      <div className="contact-detail-body">
        <label className="contact-field">
          <span className="contact-field-label">Name *</span>
          <input
            ref={nameRef}
            type="text"
            autoComplete="name"
            value={draft.name}
            placeholder="e.g. Anders Plumbing"
            onChange={(e) => setField('name', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') onCancel();
            }}
          />
        </label>
        <label className="contact-field">
          <span className="contact-field-label">Role / company</span>
          <input
            type="text"
            autoComplete="organization"
            value={draft.role}
            placeholder="e.g. Plumber, supplier, friend"
            onChange={(e) => setField('role', e.target.value)}
          />
        </label>
        <label className="contact-field">
          <span className="contact-field-label">Phone</span>
          <input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={draft.phone}
            placeholder="+45 …"
            onChange={(e) => setField('phone', e.target.value)}
          />
        </label>
        <label className="contact-field">
          <span className="contact-field-label">Email</span>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            spellCheck={false}
            value={draft.email}
            placeholder="name@example.com"
            onChange={(e) => setField('email', e.target.value)}
          />
        </label>
        <label className="contact-field">
          <span className="contact-field-label">Address</span>
          <input
            type="text"
            autoComplete="street-address"
            value={draft.address}
            placeholder="Street, postal code, city"
            onChange={(e) => setField('address', e.target.value)}
          />
        </label>
        <label className="contact-field">
          <span className="contact-field-label">Notes</span>
          <textarea
            rows={3}
            value={draft.notes}
            placeholder="What they do, when they're available, anything to remember…"
            onChange={(e) => setField('notes', e.target.value)}
          />
        </label>

        <div className="contact-form-actions">
          <button
            className="btn-primary"
            onClick={submit}
            disabled={busy || !draft.name.trim()}
          >
            {busy ? 'Saving…' : 'Save contact'}
          </button>
          <button className="btn-quiet" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
