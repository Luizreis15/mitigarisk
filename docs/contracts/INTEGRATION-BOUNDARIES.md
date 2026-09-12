# Integration boundaries

## Dependency direction

Dependencies flow inward:

```text
Presentation and routes
        ↓
Application use cases
        ↓
Domain contracts
        ↑
Data, email, queue, and provider adapters
```

Presentation components never import a Supabase or Resend administrative client. They consume typed application results. Provider adapters implement interfaces owned by the application or domain boundary, not the reverse.

## Frontend boundary

The Cursor prototype may use `apps/web/lib/demo` as a replaceable adapter. Route components own layout and view composition only. When live data is introduced, demonstration adapters are replaced behind typed use cases; visual components do not receive database rows directly.

## Domain boundary

Domain objects use explicit tenant, actor, correlation, policy-version, and evidence identifiers. Money is integer minor units. Time is UTC ISO 8601 at external boundaries. Risk decisions use stable reason codes; display strings remain a presentation concern.

English message catalogs own display copy. Locale formatters consume explicit locale, IANA time zone, country, and ISO currency configuration. Domain and persistence layers never branch on translated labels.

## Supabase boundary

Browser code may use only public configuration and user-scoped clients. Administrative clients are server-only, never cached across authorization contexts, and never imported by client components. RLS is mandatory defense in depth; server permission checks remain authoritative.

Database migrations are the schema source of truth. Generated database types may depend on migrations, while migrations never depend on generated application code.

## Resend boundary

The application creates a notification request before calling an email adapter. Resend identifiers and delivery events are provider metadata attached to that request. UI and domain code do not call the provider SDK directly. A real send requires an approved server-side environment and explicit human authorization.

## Audit boundary

Business audit events are not application logs. An audit event records tenant, actor, action, target, timestamp, correlation ID, and approved evidence metadata. Logs may reference identifiers but must not duplicate sensitive payloads.

## Merge compatibility

The platform foundation must not assume the final component hierarchy. The frontend must not invent database schemas. Integration occurs through reviewed TypeScript contracts after both foundations are accepted. Any disagreement between UI demonstration fields and domain contracts becomes a mapping decision, not an unreviewed schema change.
