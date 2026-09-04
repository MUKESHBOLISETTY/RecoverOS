# RecoverOS Failure Handling

RecoverOS is an asynchronous, integration-heavy recovery system. Failures are therefore treated as normal distributed-system conditions rather than exceptional situations.

The primary failure-handling principle is:

> **When the system cannot establish that an action is safe and valid, it should preserve state, avoid unsafe side effects, and retry or stop according to the recovery state.**

This document describes production failure modes and the intended behavior of the RecoverOS architecture.

---

## Table of Contents

- [Failure Handling Philosophy](#failure-handling-philosophy)
- [Failure State Model](#failure-state-model)
- [Webhook Failures](#webhook-failures)
- [Duplicate Webhooks](#duplicate-webhooks)
- [Stale Recovery Jobs](#stale-recovery-jobs)
- [Worker Failures](#worker-failures)
- [Scheduler and Follow-up Failures](#scheduler-and-follow-up-failures)
- [LLM Failures](#llm-failures)
- [Policy Validation Failures](#policy-validation-failures)
- [Tool Execution Failures](#tool-execution-failures)
- [Shopify Failures](#shopify-failures)
- [Razorpay Failures](#razorpay-failures)
- [Communication Provider Failures](#communication-provider-failures)
- [Recovery Verification Failures](#recovery-verification-failures)
- [Shopify + Razorpay Correlation Failures](#shopify--razorpay-correlation-failures)
- [Redis Failures](#redis-failures)
- [PostgreSQL Failures](#postgresql-failures)
- [Audit Pipeline Failures](#audit-pipeline-failures)
- [SSE Failures](#sse-failures)
- [Partial Execution](#partial-execution)
- [Concurrency and Race Conditions](#concurrency-and-race-conditions)
- [Safe Recovery Behavior](#safe-recovery-behavior)
- [Failure Recovery Matrix](#failure-recovery-matrix)

---

## Failure Handling Philosophy

A production recovery system must assume that:

- providers can time out,
- webhooks can be duplicated,
- workers can restart,
- jobs can become stale,
- caches can disappear,
- network requests can fail,
- an LLM can return an invalid decision,
- verification can become temporarily unavailable,
- two events can arrive concurrently,
- and an operation can succeed externally while the local process fails before recording the result.

RecoverOS therefore separates four concerns:

```text
Decision
   ↓
Validation
   ↓
Execution
   ↓
Verification
```

A failure in one stage must not automatically be interpreted as success or failure in another stage.

For example:

```text
Discount API succeeded
        ↓
Worker crashed before local state update
        ↓
Unknown local execution state
        ↓
Do NOT blindly issue another discount
```

Durable state, idempotency, and fresh verification are used to resolve such situations safely.

---

## Failure State Model

RecoverOS uses explicit semantic states where uncertainty matters.

For recovery verification:

| State | Meaning |
|---|---|
| `RECOVERED` | Fresh evidence confirms the recovery |
| `NOT_RECOVERED` | Fresh evidence confirms recovery did not occur |
| `VERIFICATION_UNAVAILABLE` | The system could not safely perform verification |
| `UNKNOWN` | Available evidence is ambiguous |

These states prevent infrastructure failures from being converted into false business outcomes.

For execution, an action can also be represented through its persisted lifecycle, rather than assuming that an API request necessarily equals successful business completion.

---

## Webhook Failures

External providers are asynchronous event sources.

A webhook processing flow should be:

```text
Receive Event
    ↓
Verify Authenticity
    ↓
Resolve Merchant / Integration
    ↓
Validate Event
    ↓
Deduplicate
    ↓
Persist / Process
```

### Invalid webhook

When authenticity or structure validation fails:

```text
Reject
  ↓
No recovery state mutation
  ↓
No external recovery action
```

### Temporary internal failure

If a valid event cannot currently be processed because of a transient application or database problem, it should remain eligible for provider retry or internal retry according to the ingestion architecture.

### Provider outage

The system should not fabricate state when the provider cannot be reached.

The recovery case remains based on the last authoritative durable state until fresh provider evidence becomes available.

---

## Duplicate Webhooks

Duplicate delivery is expected in distributed webhook systems.

RecoverOS uses idempotency and durable state constraints so the same trigger does not repeatedly create the same business outcome.

The desired behavior is:

```text
Webhook A ──► Process
Webhook A ──► Duplicate
                 │
                 ▼
             No duplicate
             recovery action
```

Duplicate detection should happen before side effects whenever possible.

---

## Stale Recovery Jobs

A scheduled recovery job can become stale before its execution time.

Example:

```text
10:00  Checkout abandoned
10:05  Recovery follow-up scheduled
10:07  Customer completes order
10:10  Scheduled job becomes due
```

The 10:10 worker must not blindly execute the old plan.

Instead:

```text
Claim job
   ↓
Load current authoritative state
   ↓
Check current recovery status
   ↓
Verify eligibility
   ↓
Execute only if still valid
```

If the customer has recovered, the job is cancelled or safely skipped.

This prevents unnecessary communication, discounts, and other side effects.

---

## Worker Failures

Workers are expected to restart or fail during processing.

### Failure before execution

If the worker fails before a recovery action is issued:

```text
Durable case/execution state
        ↓
Retry eligible
```

The action should not be considered completed.

### Failure after external execution

The harder case is:

```text
Worker
  ↓
External provider
  ↓
Success
  ↓
Worker crashes
  ↓
Local state not updated
```

The system must not automatically repeat the action.

Recovery relies on persisted execution identity, provider-side idempotency where supported, and fresh state/verification to determine the safe next step.

### Worker concurrency

Multiple workers attempting the same job should be coordinated with locks and durable execution identity.

Only the worker that successfully claims the work should proceed with the side effect.

---

## Scheduler and Follow-up Failures

Follow-up scheduling itself can fail or a scheduled job can become unavailable.

The system should distinguish:

```text
Schedule not created
        ≠
Follow-up executed
```

A failed scheduling operation should not generate a false audit event claiming that the follow-up exists.

Where retry is safe, scheduling can be retried with idempotent identifiers.

Where state is ambiguous, the system should prefer a safe retry/reconciliation path over duplicate communication.

---

## LLM Failures

The LLM is not part of the trusted execution boundary.

Possible failures include:

- timeout
- provider unavailable
- malformed output
- unsupported action
- invalid field values
- hallucinated tool parameters
- decision outside merchant policy

### Timeout or provider failure

The system should not execute an action that has no valid decision.

```text
LLM unavailable
      ↓
No tool execution
      ↓
Persist safe state
      ↓
Retry or stop according to policy
```

### Malformed output

Invalid model output must fail closed.

The server should reject the decision rather than attempting to infer the model's intended action.

### Unsafe recommendation

A recommendation that violates policy is blocked by the server-side validator.

The model cannot bypass the validator.

---

## Policy Validation Failures

Policy validation is a hard boundary between reasoning and side effects.

Examples include:

- recovery type disabled
- recovery window expired
- communication limit exceeded
- discount above merchant maximum
- requested action unavailable for current integrations
- invalid action parameters

The desired behavior is:

```text
LLM Decision
     ↓
Validator
     ↓
Rejected
     ↓
No external side effect
     ↓
Audit policy block
```

Policy failure is not a provider failure. It is an intentional security and business-control outcome.

---

## Tool Execution Failures

A bounded tool may fail because of:

- invalid provider response
- timeout
- rate limiting
- network interruption
- provider outage
- credential failure
- unsupported operation

Tool failures should produce an explicit execution result.

The system must not translate:

```text
provider timeout
```

into:

```text
action succeeded
```

or:

```text
revenue recovered
```

The next step depends on whether the external state can be safely known.

---

## Shopify Failures

Shopify operations can fail for reasons such as:

- network errors
- API errors
- authentication failures
- rate limiting
- unavailable resources
- current state differing from cached state

### Checkout state

A checkout recovery should only continue when the current checkout remains eligible.

### Discount creation

If Shopify discount creation fails:

```text
No successful discount state update
```

The persisted previous discount level must not be advanced merely because an attempt was made.

### Protected data limitations

When an endpoint or provider response does not expose sufficient evidence for a particular query, RecoverOS must not substitute assumptions for missing evidence.

Verification can move to an available supported evidence path, remain unavailable, or become ambiguous depending on the result.

---

## Razorpay Failures

Razorpay operations can fail through:

- credential issues
- provider errors
- network timeouts
- rate limits
- invalid parameters
- temporary availability problems

A failed payment recovery-link creation must not be recorded as a successful payment intervention.

A payment link being created also does not prove that a customer paid.

The payment result requires fresh provider evidence.

---

## Communication Provider Failures

Communication channels are side effects, so failures are recorded separately from business recovery.

Examples:

```text
Email provider timeout
SMS provider unavailable
Invalid destination
Provider rejected message
```

A failed communication should not count as a completed recovery communication.

At the same time:

```text
Communication sent
        ≠
Revenue recovered
```

A later verification step still determines whether the commercial outcome occurred.

For provider operations where the external result is ambiguous, the system should avoid blindly repeating a potentially delivered message and should use the action's durable execution identity and provider evidence when available.

---

## Recovery Verification Failures

Verification is intentionally treated differently from intervention.

### Verification succeeds

Fresh evidence determines:

```text
RECOVERED
or
NOT_RECOVERED
```

### Verification temporarily unavailable

Return:

```text
VERIFICATION_UNAVAILABLE
```

The system should preserve the current recovery state and retry according to the bounded recovery policy.

### Ambiguous evidence

Return:

```text
UNKNOWN
```

The system should not claim recovery.

### Why this matters

A provider outage at verification time must not create false revenue.

```text
Unable to verify
      ≠
Recovered
```

---

## Shopify + Razorpay Correlation Failures

One of the most important failure modes is the absence of a deterministic correlation between a Shopify checkout and a Razorpay payment.

The system may encounter:

```text
Shopify Checkout
      │
      │ no trusted shared identifier
      X
      │
Razorpay Payment
```

### Unsafe behavior

It is unsafe to automatically attach the payment to the checkout based only on:

- equal or similar amounts
- matching email
- matching phone
- close timestamps

These are correlation signals, not proof.

### Safe behavior

RecoverOS follows a trust hierarchy:

```text
Trusted deterministic correlation
           ↓
Bounded heuristic correlation
           ↓
No correlation / ambiguous
```

When the evidence does not meet the required threshold, the payment remains separate or unresolved.

This avoids:

- false recovery attribution
- wrong customer association
- incorrect case closure
- duplicate recovery actions

Correlation uncertainty is therefore treated as a data-integrity failure, not something the system should hide.

---

## Redis Failures

Redis supports:

- hot-path caching
- deduplication
- debounce state
- locks
- scheduling coordination
- live Pub/Sub

Redis is not the persistent source of truth.

### Cache unavailable

A cache failure should not imply that the underlying business record has disappeared.

The application can fall back to authoritative PostgreSQL reads where the operation permits it.

### Stale cache

Critical operations should refresh or validate authoritative state before performing consequential side effects.

### Lock failure

When coordination state cannot be safely acquired, the worker should not assume ownership of the job.

This prevents concurrent execution.

### Pub/Sub failure

A Pub/Sub failure may prevent a live SSE update from being delivered.

It must not invalidate the durable PostgreSQL audit record.

The merchant UI can recover current state through REST.

---

## PostgreSQL Failures

PostgreSQL stores authoritative recovery state.

Possible failures include:

- temporary connection failure
- transaction failure
- query timeout
- constraint violation
- database unavailable

### Before external side effect

If the required durable state cannot be safely read or persisted, consequential external actions should generally not proceed.

The system should fail closed rather than act on unknown tenant, policy, or recovery state.

### Transaction failures

A failed transaction must not be treated as committed.

Database constraints remain important protection against duplicate or inconsistent state.

### Recovery after outage

Once PostgreSQL is available, durable state provides the basis for retrying, reconciling, or safely resuming work.

---

## Audit Pipeline Failures

The audit system has two responsibilities:

```text
Persistent audit
      +
Live event delivery
```

These are intentionally separate.

### Persistent audit failure

If an audit persistence operation fails, the system should record/handle the failure without silently claiming that the audit was persisted.

For consequential operations, the application should follow its transaction and failure policy rather than creating misleading audit history.

### Live event failure

A Redis Pub/Sub or SSE failure must not delete or invalidate the persistent audit history.

The merchant can retrieve durable state through REST.

---

## SSE Failures

SSE is a real-time delivery path, not the source of truth.

Possible conditions include:

- browser disconnect
- network interruption
- server restart
- Redis Pub/Sub interruption
- token expiry

The correct behavior is:

```text
SSE disconnected
      ↓
No business state rollback
      ↓
Reconnect / refresh
      ↓
REST retrieves authoritative current state
```

A missing live event must not mean that a recovery action did not happen.

Likewise, seeing a live event must not be treated as durable proof until the corresponding state is persisted.

---

## Partial Execution

Partial execution is one of the most important distributed failure cases.

Example:

```text
Policy approved
      ↓
Email sent
      ↓
Discount creation attempted
      ↓
Shopify timeout
```

The recovery journey is not simply:

```text
SUCCESS
```

Instead, the system records the actions individually and determines the next safe action from current state.

Individual action states are important because an entire recovery journey can contain multiple independent side effects.

The next decision must consider:

- what definitely happened,
- what definitely did not happen,
- what remains unknown,
- current merchant policy,
- current recovery state.

---

## Concurrency and Race Conditions

Recovery events can arrive concurrently.

Examples:

```text
checkout/update
       +
orders/create
       +
scheduled follow-up
```

all occurring close together.

The system uses:

- locks
- idempotency constraints
- durable state checks
- tenant-aware correlation
- execute-time verification

to prevent race conditions from creating unsafe outcomes.

### Recovery completion race

Suppose a follow-up worker starts while an order-completion event arrives.

The worker must check current state before executing.

If the order has completed, the scheduled action should be cancelled or skipped.

### Duplicate execution race

Two workers may observe the same due job.

Only one should acquire the coordination lock / execution ownership.

---

## Safe Recovery Behavior

Across all failure types, RecoverOS follows a consistent safety hierarchy:

```text
Can prove it is safe?
        │
     Yes ▼
     Execute
        │
        ▼
   Verify result

        │
     No / Unknown
        │
        ▼
   Do not invent state
        │
        ├── Retry when safe
        ├── Reconcile when needed
        └── Stop / remain safe
```

The system prefers:

```text
No action
```

over:

```text
Unverified or unauthorized action
```

when the alternative could create a financial, customer, or tenant-integrity problem.

---

## Failure Recovery Matrix

| Failure | Primary Response | External Side Effect? | Business Outcome |
|---|---|---:|---|
| Invalid webhook | Reject | No | No recovery mutation |
| Duplicate webhook | Idempotent no-op | No duplicate side effect | Existing state preserved |
| Stale job | Re-check current state | Usually no | Skip/cancel if no longer eligible |
| Worker crash before action | Retry | No | Action remains pending |
| Worker crash after ambiguous provider result | Reconcile / verify | Avoid blind repeat | Outcome unresolved until safe |
| LLM timeout | Retry/stop safely | No | No unvalidated action |
| Malformed LLM output | Reject | No | Decision blocked |
| Policy violation | Block | No | Policy-blocked |
| Shopify action failure | Record failure | Attempt may have occurred | No false success |
| Razorpay action failure | Record failure | Attempt may have occurred | No false payment success |
| Communication failure | Record action failure | Possibly none/ambiguous | No completed communication claim |
| Verification unavailable | Retry later | No new action solely from uncertainty | `VERIFICATION_UNAVAILABLE` |
| Verification ambiguous | Preserve state | No unsafe action | `UNKNOWN` |
| No Shopify/Razorpay correlation | Keep separate/unresolved | No forced association | No false attribution |
| Redis cache failure | Use authoritative state where possible | Only with safe state | Correctness preserved |
| Redis Pub/Sub failure | Persist state; live update may be missed | No effect on business state | UI refreshes via REST |
| PostgreSQL unavailable | Fail closed for consequential operations | Normally no | Retry after persistence recovers |
| SSE disconnect | Reconnect / REST refresh | No | UI catches up |
| Concurrent worker | Lock/idempotency | One owner executes | Duplicate execution prevented |

---

## Failure Handling Principle

RecoverOS does not define reliability as "every request succeeds."

Instead, reliability means:

> **The system remains correct when requests, providers, workers, caches, models, and networks fail.**

The architecture therefore emphasizes:

```text
Idempotency
+ Durable State
+ Tenant Isolation
+ Bounded Execution
+ Fresh Verification
+ Explicit Uncertainty
+ Safe Retry
+ Auditability
```

A recovery system is trustworthy not because failures never happen, but because failures do not silently turn into unsafe actions or false revenue claims.
