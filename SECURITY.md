# RecoverOS Security

RecoverOS is designed around a **defense-in-depth security model** in which authentication, tenant isolation, server-side authorization, bounded execution, external-provider boundaries, and durable auditability work together.

This document describes the production security model of RecoverOS. It intentionally focuses on architectural controls rather than implementation-specific deployment secrets or local development configuration.

---

## Table of Contents

- [Security Goals](#security-goals)
- [Threat Model](#threat-model)
- [Authentication](#authentication)
- [Tenant Isolation and Authorization](#tenant-isolation-and-authorization)
- [API Security](#api-security)
- [Webhook Security](#webhook-security)
- [Integration and Credential Security](#integration-and-credential-security)
- [LLM Security and Bounded Autonomy](#llm-security-and-bounded-autonomy)
- [Policy Enforcement](#policy-enforcement)
- [Tool Execution Security](#tool-execution-security)
- [Payment and Financial Safety](#payment-and-financial-safety)
- [Correlation Safety](#correlation-safety)
- [Redis Security](#redis-security)
- [PostgreSQL and Data Security](#postgresql-and-data-security)
- [Audit and Security Observability](#audit-and-security-observability)
- [SSE Security](#sse-security)
- [Data Exposure Principles](#data-exposure-principles)
- [Security Boundaries and Trust Model](#security-boundaries-and-trust-model)
- [Operational Security](#operational-security)
- [Future Hardening](#future-hardening)

---

## Security Goals

The primary security goals of RecoverOS are:

1. **Prevent cross-merchant data access.**
2. **Prevent unauthorized external actions.**
3. **Keep financial and commerce operations bounded by server-side controls.**
4. **Treat the LLM as an untrusted decision component rather than an authority.**
5. **Protect integration credentials and sensitive provider data.**
6. **Maintain an auditable record of recovery activity.**
7. **Fail safely when external evidence is missing, stale, or ambiguous.**
8. **Prevent duplicate or concurrent recovery execution from causing unintended actions.**

The security architecture follows a simple principle:

> **No user, model, webhook, cache entry, or external provider response should independently have enough authority to perform an unsafe recovery operation.**

---

## Threat Model

RecoverOS operates across a merchant application, asynchronous workers, an LLM decision layer, Redis, PostgreSQL, and external providers.

Relevant threat categories include:

### Unauthorized merchant access

An authenticated user attempts to access another merchant's cases, policies, integrations, executions, or audit records.

### Forged or replayed webhooks

An attacker attempts to create or modify recovery state by sending fabricated provider events or replaying previously received events.

### Malicious or manipulated model output

An LLM produces an invalid discount, unauthorized action, unsafe tool request, or otherwise attempts to operate outside merchant policy.

### Compromised integration credentials

A Shopify, Razorpay, Gmail, or other provider credential is exposed and used outside the intended integration boundary.

### Cache corruption or stale state

Redis contains stale or manipulated state that could cause incorrect execution.

### Duplicate execution

Retries, duplicate webhooks, worker races, or scheduler races cause the same recovery action to run more than once.

### Incorrect cross-system correlation

A payment is incorrectly associated with a commerce recovery case, producing false recovery attribution or actions on the wrong customer journey.

### Sensitive data leakage

Customer, merchant, integration, or internal execution information is exposed through logs, APIs, SSE events, or merchant-facing UI.

---

## Authentication

RecoverOS requires authenticated access to merchant-facing application functionality.

The authentication layer establishes the identity used to create the application tenant context.

Authentication is only the first security boundary.

After authentication, every protected operation must still enforce:

```text
Authenticated User
        ↓
Tenant Context
        ↓
Authorized Resource
        ↓
Authorized Action
```

Authentication must not be treated as proof that a user can access every recovery object in the database.

---

## Tenant Isolation and Authorization

Tenant isolation is a core security boundary.

RecoverOS is a multi-merchant system, so persistent and runtime operations are scoped to the authenticated merchant.

### Merchant-scoped objects

Recovery-related resources include concepts such as:

- `RecoveryCase`
- `AgentExecution`
- `RecoveryAction`
- `Outcome`
- `AuditEvent`
- merchant policy
- integration connections
- merchant-scoped agent configuration

These must be accessed in the context of the authenticated merchant.

### No client-controlled tenant switching

The client should not be able to select an arbitrary merchant identifier and thereby change authorization scope.

The server derives tenant context from authenticated identity and trusted server-side context.

### Authorization before data access

Authorization should occur before returning or mutating merchant data.

The expected pattern is:

```text
Request
  ↓
Authenticate
  ↓
Resolve merchant context
  ↓
Authorize resource
  ↓
Read / write resource
```

### External events follow the same boundary

A webhook or provider callback must not be allowed to write directly into an arbitrary merchant's recovery case.

The event must first be mapped to a trusted integration and merchant context.

---

## API Security

The REST API is the primary durable application interface.

Security controls include:

### Authentication on protected endpoints

Protected application resources require authenticated access.

### Server-side input validation

Request payloads are validated on the server.

Client-side validation is treated only as a usability feature, not a security boundary.

### Strict resource scoping

Database queries must include the authenticated merchant scope when accessing tenant-owned records.

### Controlled mutation

Sensitive fields such as internal status, agent configuration, execution ownership, and integration credentials are not accepted as arbitrary client-controlled values.

### Safe errors

API errors should expose enough information for the client to handle the error without leaking:

- provider secrets
- raw credentials
- internal stack traces
- hidden execution metadata
- unrelated tenant information

### Rate limiting

Publicly reachable and abuse-prone endpoints should be protected with rate limits appropriate to their sensitivity.

Higher-risk endpoints include authentication, webhook ingestion, integration callbacks, and expensive recovery operations.

---

## Webhook Security

Shopify and Razorpay are external event sources and therefore untrusted at the application boundary until validated.

A production webhook path should apply:

```text
Receive
  ↓
Authenticate / verify webhook
  ↓
Identify trusted integration
  ↓
Resolve merchant
  ↓
Validate event shape
  ↓
Deduplicate / enforce idempotency
  ↓
Process event
```

### Webhook authenticity

Provider-supported webhook verification mechanisms should be used so the system can distinguish genuine provider events from arbitrary HTTP requests.

### Tenant resolution

The webhook must resolve to the merchant connection associated with that provider account/store.

### Event validation

The system should validate event type, required fields, and expected object relationships before creating or modifying recovery state.

### Replay resistance

Webhook processing should use durable idempotency or event identity controls where supported.

A repeated delivery must not create repeated recovery actions.

---

## Integration and Credential Security

RecoverOS integrates with systems such as:

- Shopify
- Razorpay
- Gmail
- Google Sheets for the SMS integration path

Integration credentials are high-value secrets.

### Secret handling

Provider secrets should:

- never be returned to the browser after secure storage
- never be embedded in client-side code
- never be written into ordinary application logs
- never be included in audit-event payloads
- only be available to the server-side integration boundary that needs them

### OAuth

For OAuth-based providers, authorization should be completed through the provider's callback flow.

Redirect URIs should be controlled by the application rather than accepted as arbitrary user-supplied destinations.

### Credential scope

Provider credentials should be used only for the merchant integration for which they were configured.

A tool must not be able to arbitrarily select another merchant's credential set.

### Credential failure isolation

A provider credential failure should remain isolated to the affected merchant/provider connection and should not cause unrelated merchants to execute using fallback credentials.

---

## LLM Security and Bounded Autonomy

The LLM is intentionally placed behind deterministic controls.

The architecture is:

```text
Recovery Context
      ↓
Merchant-scoped Agent
      ↓
Skill Selection
      ↓
LLM Decision
      ↓
Server-side Validator
      ↓
Bounded Tool Execution
```

The model is **not** a trusted execution authority.

### The model cannot bypass policy

A model response that requests an invalid action is rejected by the server-side validator.

### The model cannot directly call providers

The model does not receive unrestricted credentials or unrestricted network access.

External operations happen through bounded tools.

### Explicit current state

Important recovery state is supplied explicitly to the decision layer rather than relying on the model to remember previous actions.

This includes state relevant to:

- recovery progress
- merchant policy
- prior intervention limits
- available integrations
- current recovery context

### No chain-of-thought exposure

Merchant-facing systems should expose a safe decision rationale or operational summary where appropriate, not hidden chain-of-thought.

### Treat model output as untrusted input

Model-generated values must be parsed and validated as untrusted data before execution.

---

## Policy Enforcement

Merchant policy is enforced server-side.

Relevant controls include:

- enabled recovery types
- recovery window
- daily communication limits
- maximum discount
- permitted communication channels
- available integrations

The frontend may display and edit policy, but it does not own the enforcement decision.

### Discount boundary

The system maintains an invariant around recovery discounts:

```text
previous applied discount
        ≤
requested discount
        ≤
merchant maximum discount
```

The current applied discount state is persisted with the recovery journey.

A model cannot bypass the maximum by changing the request format or attempting to reset prior state.

State is updated only after the corresponding external discount operation succeeds.

---

## Tool Execution Security

Tools represent the security boundary between agent decisions and real-world side effects.

Each tool should be:

- explicitly allowlisted
- server-side controlled
- tenant scoped
- input validated
- policy checked
- auditable
- idempotent where appropriate

Examples include:

### Communication tools

Send approved recovery communications through configured channels.

### Commerce tools

Create bounded Shopify recovery actions.

### Payment tools

Create bounded Razorpay payment recovery actions.

The tool layer must not accept arbitrary provider endpoints, credentials, merchant identifiers, or action types from an LLM response.

---

## Payment and Financial Safety

Payment operations receive additional restrictions because incorrect actions can have direct financial impact.

### Server authorization

Payment actions must be initiated through authorized server-side tools.

### Merchant-scoped credentials

The payment provider credential must belong to the authenticated merchant's integration.

### Bounded action surface

The payment tool should expose only the supported recovery operation rather than arbitrary payment-provider API access.

### Outcome verification

Creating a payment link or initiating a payment-related recovery action is not equivalent to receiving payment.

The payment outcome must be verified from current provider evidence.

---

## Correlation Safety

Shopify and Razorpay do not necessarily provide a deterministic cross-system relationship between a checkout and payment.

This creates a specific security and integrity risk:

```text
Shopify Checkout A
        │
        X  ← insufficient trusted evidence
        │
Razorpay Payment B
```

RecoverOS therefore treats correlation as a controlled decision rather than an assumption.

### Trusted correlation first

A trusted shared identifier or merchant-controlled correlation has priority.

### Heuristic correlation is constrained

Signals such as:

- email
- phone
- amount
- timing
- shared merchant connection

may be considered only through an explicitly bounded correlation process.

### Ambiguity must not become authority

When evidence is insufficient, the system should avoid confidently attaching an event to the wrong recovery journey.

This protects both:

- tenant/customer data integrity
- recovery and revenue attribution integrity

---

## Redis Security

Redis is used for performance and runtime coordination.

It may contain short-lived or cached information related to:

- hot application state
- deduplication
- debounce state
- locks
- scheduling coordination
- Pub/Sub events

### Redis is not authoritative

PostgreSQL remains the persistent source of truth.

A stale or missing Redis value must not permanently redefine business state.

### Cache trust boundary

Cached values should be treated as derived runtime state.

Critical decisions should reload authoritative PostgreSQL state when freshness or correctness matters, particularly immediately before externally visible recovery actions.

### Isolation

Redis keys and channels must be merchant-aware where the underlying state is tenant-specific.

### Pub/Sub

Redis Pub/Sub is a live event transport.

It should not be treated as a secure or durable audit store.

---

## PostgreSQL and Data Security

PostgreSQL stores durable recovery state.

Important protections include:

### Tenant-scoped queries

Application data access must consistently enforce merchant scope.

### Database constraints

Database-level uniqueness and relationship constraints provide a second line of defense against inconsistent or duplicate state.

### Durable state separation

The system stores recovery concepts separately, including:

- recovery cases
- executions
- recovery actions
- outcomes
- audit events

This makes authorization and auditing more explicit than storing all activity as loosely structured application metadata.

### Sensitive data minimization

Only the data necessary for recovery operations should be persisted.

Secrets and credentials should not be stored in ordinary recovery or audit records.

---

## Audit and Security Observability

RecoverOS maintains a durable audit trail for meaningful recovery transitions.

Examples include:

- case creation
- case state changes
- agent start
- agent decision
- policy validation
- policy block
- communication execution
- discount creation
- payment-link creation
- follow-up scheduling
- verification completion
- recovery confirmation
- recovery stop

Audit records support:

- operational investigation
- customer-journey reconstruction
- policy review
- security investigation
- dispute analysis

### Audit events are separate from live delivery

A live SSE or Redis Pub/Sub failure should not remove the durable audit record.

The architecture therefore separates:

```text
Persistent Audit
      +
Live Event Delivery
```

### Sensitive information

Audit events should contain operationally useful information without storing provider credentials, authentication tokens, or hidden model reasoning.

---

## SSE Security

Server-Sent Events provide live recovery updates to the merchant application.

SSE connections must be authenticated and tenant-scoped.

### Authentication

The stream should accept only authenticated application sessions/tokens according to the application's chosen authentication mechanism.

### Tenant-scoped events

A merchant must receive only events belonging to that merchant.

### Event filtering

Client-side filtering may improve UI behavior, but it must not replace server-side authorization.

### No sensitive internal payloads

SSE events should contain only the information necessary for the merchant UI.

Internal UUIDs, credentials, raw provider responses, and hidden model data should not be exposed merely because an event is being streamed.

---

## Data Exposure Principles

RecoverOS follows the principle of **minimum necessary exposure**.

The merchant-facing application should expose:

- recovery status
- revenue-at-risk and recovery metrics
- customer-facing recovery context where needed
- intervention summaries
- safe decision rationale
- audit history

It should not expose:

- provider secrets
- OAuth tokens
- raw integration credentials
- hidden model reasoning
- internal implementation-only metadata
- unrelated tenant data
- raw Redis coordination state
- arbitrary provider API responses

Internal identifiers may exist in the backend for correctness and traceability, but they should not be surfaced as merchant-facing content unless there is a legitimate operational reason.

---

## Security Boundaries and Trust Model

RecoverOS intentionally creates multiple trust boundaries.

```text
                    UNTRUSTED / EXTERNAL
                           │
          ┌────────────────┼────────────────┐
          │                │                │
       Shopify          Razorpay       User Input
          │                │                │
          └────────────────┼────────────────┘
                           ▼
                  Authentication /
                  Webhook Verification
                           │
                           ▼
                   Tenant Context
                           │
                           ▼
                 Recovery Case State
                           │
                           ▼
                 Merchant-scoped Agent
                           │
                           ▼
                     LLM Decision
                           │
                           ▼
                Server-side Validator
                           │
                           ▼
                 Bounded Tool Layer
                           │
                    ┌──────┴──────┐
                    ▼             ▼
               External APIs   Persistent State
```

The key rule is:

> **Trust decreases as data crosses boundaries; authorization and validation are re-established before sensitive operations.**

---

## Operational Security

Production deployments should additionally protect the infrastructure surrounding the application.

Recommended controls include:

- encrypted transport for application and provider communication
- secure secret management
- restricted database access
- restricted Redis access
- least-privilege service accounts
- protected CI/CD credentials
- dependency and image scanning
- centralized security logging
- backup and recovery procedures
- controlled production access
- credential rotation procedures
- incident response procedures

Application-level security should not be considered sufficient without infrastructure-level controls.

---

## Future Hardening

Future versions of RecoverOS can strengthen the security posture with additional controls such as:

- comprehensive rate limiting and abuse detection
- stronger webhook replay protection
- automated secret rotation
- encrypted sensitive fields at rest where required
- structured security event monitoring
- dependency vulnerability automation
- provider-specific least-privilege scopes
- stronger production network segmentation
- formal threat modeling for every new external integration
- periodic authorization and tenant-isolation tests
- security regression tests for recovery tools
- signed or tamper-evident audit pipelines where required

---

## Security Principle

RecoverOS is built around one central security principle:

> **The system may be autonomous in deciding how to recover revenue, but authority to affect real customers, payments, and merchant systems remains bounded by deterministic server-side controls.**
