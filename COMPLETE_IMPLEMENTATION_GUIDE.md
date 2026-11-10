**PayPal Aegis** is an Autonomous Milestone Escrow, Delivery Verification, and Dispute Compliance Operating System engineered for digital agencies, B2B suppliers, and service merchants. The platform unifies two-step PayPal payment holds, operational scheduling, cryptographic delivery verification, and automated chargeback defense behind a deterministic Human-in-the-Loop (HITL) security proxy.

## 1. Final Product Scope & Core Value Proposition

Merchants selling digital deliverables, software milestones, or custom B2B orders face severe operational gaps on PayPal. Unlike physical retail packages with carrier tracking scans, intangible and milestone-based goods receive zero coverage for Significantly Not As Described (SNAD) claims under US Seller Protection. If a merchant's rolling 3-month dispute ratio reaches 1.5% across more than 100 sales, PayPal moves the account from the Standard Dispute Fee tier ($15, waived if the seller wins) into the High Volume tier, assessing a non-refundable $30 fee per claim even when the merchant wins the dispute.

Simultaneously, developers building on PayPal's `@paypal/agent-toolkit` and Model Context Protocol (MCP) server (`mcp.paypal.com`) encounter critical architectural limitations:

* **Default Live Execution:** The toolkit source code defaults to live production (`sandbox: false`) when constructor parameters are omitted.


* **Unguarded Money Movement:** Tools such as `pay_order`, `create_refund`, and `accept_dispute_claim` execute immediately without human confirmation gates.


* **Missing Lifecycle Endpoints:** The MCP server exposes `accept_dispute_claim` to surrender disputes, but omits endpoints to contest claims (`provide-evidence`), settle inquiries (`make-offer`), manage two-step holds (`authorize`, `reauthorize`, `void`), or check balances.


* **Hold Expiration & ID Mutation:** Standard `intent: "AUTHORIZE"` holds lose peak capture reliability after a 3-day honor period, and calling `reauthorize` between Days 4 and 29 generates a new `authorization_id` that breaks naive integrations.


* **Reporting Delays:** The Transaction Search API (`/v1/reporting/transactions`) lags real-time by up to 3 hours and cannot filter by `updated_time`.



PayPal Aegis resolves these issues through a single vertical lifecycle—**Lock Funds Safely → Verify Deliverables → Auto-Defend Revenue**—competing simultaneously across Overall, Agentic Commerce, PayPal + AI, Most Impactful, and sponsor prize tracks.

## 2. Technology Stack & Integration Matrix

| Technology Layer | Package or Service | Integration Source | Core System Role | Targeted Prize Track |
| --- | --- | --- | --- | --- |
| Payment & Agent Core | `@paypal/agent-toolkit` & REST v1/v2 | PayPal Sandbox Portal & npm | Two-step holds, invoicing, disputes, and reporting | Overall, PayPal + AI, Agentic Commerce |
| API Context Grounding | APIMatic Context Plugin | Claude Code / Cursor MCP | Deterministic v1/v2 OpenAPI schema grounding | Best Use of APIMatic |
| Financial Command UI | AG Studio 3 / AG Grid | AG Grid npm & Studio Agent SDK | Live dispute ratio radar, ledger, and HITL console | Best Use of AG Grid |
| Schedule & Deadline UI | Bryntum Gantt & Calendar | Bryntum Suite packages | Payment-driven task shifting and dispute deadlines | Best Use of Bryntum |
| Cloud & Orchestration | Render & Render Workflows | Render Cloud & Workflows SDK | Raw-byte webhook gateway and Day-3 hold timers | Best Use of Render |
| Catalog Verification | Channel3 API / MCP | Channel3 REST & MCP Server | 100M+ SKU spec verification and replacement pricing | Best Use of Channel3 |
| Audit & Vector Search | Elasticsearch | Elastic Cloud API | kNN image verification and transaction-linked logs | Overall & Impact (Judge Panel) |
| API Audit & Automation | Postman & Zapier MCP | Postman Workspace & Zapier | Negative-testing fixtures and cross-app alerts | Overall & Demo Delivery |

### Where and How to Integrate Each Platform

**PayPal Developer Platform & Agent Toolkit**
Register a PayPal Developer account to obtain Sandbox Business and Personal credentials (`CLIENT_ID` and `CLIENT_SECRET`) from the developer dashboard. Install `@paypal/agent-toolkit` and `@paypal/mcp` from npm for foundational tool calls (`create_invoice`, `send_invoice`, `generate_invoice_qr_code`, `get_order`, `list_disputes`, `get_dispute`, and `ORDERS` / `SALES` insights). Pair the toolkit with direct HTTPS calls to `[https://api-m.sandbox.paypal.com](https://api-m.sandbox.paypal.com)` to bridge the missing Orders v2, Payments v2, Customer Disputes v1, and Reporting v1 endpoints.

**APIMatic Context Plugin**
Configure the APIMatic Context Plugin for PayPal inside your AI coding assistant (Claude Code or Cursor) at build time. Use APIMatic to pull versioned, deterministic PayPal OpenAPI schemas and generate strongly typed TypeScript interfaces for the missing REST endpoints so the LLM never hallucinates legacy NVP/SOAP parameters. Document this grounding pipeline in your repository documentation to qualify for the APIMatic prize track.

**AG Studio 3 (AG Grid)**
Integrate AG Studio 3 on the frontend using its Studio Agent Framework, custom typed widgets, Calculations UI, canvas Undo/Redo, server-side pagination, and WebMCP browser integration. Configure its async data source to translate UI filter changes directly into backend PayPal queries.

**Bryntum Gantt, Scheduler & Calendar**
Embed Bryntum Gantt and Scheduler to render project milestones and resource allocations, and embed Bryntum Calendar to display 3-day authorization honor periods alongside 10-day dispute response deadlines. Wire Bryntum's event store to your backend state stream so payment events dynamically reschedule dependent tasks.

**Render & Render Workflows**
Claim the $50 free hackathon credits on Render to deploy your full-stack web service, Redis deduplication cache, and background worker processes. Integrate the Render Workflows SDK to coordinate long-lived distributed tasks, specifically the 72-hour authorization renewal timers and asynchronous PDF evidence bundling.

**Channel3 API / MCP Server**
Activate 20,000 free API credits using promo code `PAYPAL-HACKATHON-2026`. Connect the Channel3 MCP server or REST API to your verification agent to query structured product specifications, real-time pricing, and images across more than 100 million catalog items without brittle web scraping.

**Elastic & Zapier MCP & Postman**
Connect an Elasticsearch index to store buyer IP telemetry, delivery timestamps, and kNN image embeddings. Use Zapier MCP (via the 14-day Pro trial) to dispatch instant merchant/buyer notifications, and publish a public Postman Collection containing pre-configured sandbox test requests.

## 3. Deep-Dive Architecture & Code-Level Implementation Details

### Engine 1: The SafeGate Deterministic MCP Firewall & Context Proxy

SafeGate wraps `@paypal/agent-toolkit` and your custom REST handlers inside a deterministic TypeScript proxy layer that enforces five runtime guardrails.

**1. Explicit Sandbox Lock & Version Pinning**
In the TypeScript and Python source code of `@paypal/agent-toolkit`, the constructor evaluates `this.context.sandbox = this.context.sandbox ?? false;` (or `self.sandbox = sandbox or False`), ignoring `PAYPAL_ENVIRONMENT=SANDBOX` and defaulting to the live production URL (`[https://api-m.paypal.com](https://api-m.paypal.com)`). When instantiating `new PayPalAgentToolkit(...)`, explicitly pass `sandbox: true` inside the configuration object and lock the exact package version in your dependency manifest so automated installs cannot pull unannounced behavioral changes.

**2. Dynamic Context Router & Naming Normalization**
Loading the full 30-to-43 tool catalog into an LLM prompt consumes roughly 12,600 context tokens and increases inference errors. Never pass `--tools=all` or `ALL_TOOLS_ENABLED`, especially since enabling `disputes.create` unlocks `accept_dispute_claim` (which forfeits disputes and auto-refunds the buyer). Implement a dynamic router function that inspects the current workflow phase (`ESCROW_SETUP`, `DELIVERY_AUDIT`, or `DISPUTE_DEFENSE`) and passes only the 3 to 4 required tool schemas to the model, while mapping schema naming discrepancies (`list_product` vs. `list_products` and `list_transaction` vs. `list_transactions`).

**3. In-Memory OAuth 2.0 Token Lifecycle Manager**
Avoid static plaintext access tokens in local MCP configurations. Build a token manager class that sends a `POST` request to `[https://api-m.sandbox.paypal.com/v1/oauth2/token](https://api-m.sandbox.paypal.com/v1/oauth2/token)` with header `Authorization: Basic <base64(CLIENT_ID:CLIENT_SECRET)>` and body `grant_type=client_credentials`. Because sandbox tokens expire in 3 to 8 hours (and production tokens in 31,668 to 32,400 seconds) with no refresh token, parse the `expires_in` integer from the JSON response and schedule an automatic background renewal 15 minutes prior to expiration.

**4. Deterministic 36-Character Idempotency Injector & Snapshot Cache**
PayPal supports idempotency via the `PayPal-Request-Id` header on `POST` requests, enforcing a strict maximum length of 38 single-byte characters. Moreover, the default `@paypal/agent-toolkit` omits idempotency headers on `create_refund`, risking double payouts on network retries. In your HTTP client interceptor, generate a standard 36-character v4 UUID for every `POST` operation, attach it as `PayPal-Request-Id`, and persist the initial response payload in your database keyed by that UUID. Because replaying a request with an existing `PayPal-Request-Id` on PayPal returns the *current* resource status rather than the initial historical snapshot (and provides no replay signal header), serve retries directly from your local snapshot cache to preserve audit accuracy.

**5. Human-in-the-Loop (HITL) Execution Gate**
In the native toolkit, tool invocations execute `const result = await this._paypal.run(tool.method, arg);` immediately. Wrap this execution method in an interceptor that checks whether the target tool mutates funds or legal state (`pay_order`, `create_refund`, `accept_dispute_claim`, `send_invoice`, `capture_authorization`, `make_dispute_offer`, or `provide_dispute_evidence`). Instead of calling the PayPal API directly, serialize the validated payload into a `PENDING_APPROVAL` state inside Render Workflows, emit a real-time event to the AG Studio 3 approval console, and execute the outbound HTTP call only after receiving a signed human confirmation callback.

### Engine 2: Two-Step Milestone Authorization & Day-3 Hold Manager

To support multi-week service and B2B schedules without exposing buyers to unverified upfront payments or merchants to expired holds, implement a stateful two-step authorization lifecycle.

**1. Order Creation with Authorization Intent**
When an AI agent parses a Statement of Work into milestone phases, invoke `POST /v2/checkout/orders` with payload field `intent: "AUTHORIZE"`, specifying the milestone value in `purchase_units[0].amount`. Once the buyer approves the order via the returned `approve` HATEOAS link, invoke `POST /v2/checkout/orders/{order_id}/authorize` with a 36-character `PayPal-Request-Id`. Extract the initial authorization identifier from `purchase_units[0].payments.authorizations[0].id` and store it alongside the authorization timestamp.

**2. Durable Day-3 Honor Period Reauthorization & ID Pointer Rotation**
While a PayPal authorization remains valid for 29 days, PayPal guarantees peak capture reliability only during the first 3 days (the honor period). Capturing after Day 3 triggers a card-issuer re-check that can fail if buyer funds shifted. Furthermore, calling the reauthorize endpoint between Days 4 and 29 returns a *brand-new* `authorization_id`.

* Register a durable timer in **Render Workflows** when the initial authorization succeeds.


* When the 72-hour honor window approaches (or when triggered via the Judge Demo toolbar), the workflow calls `POST /v2/payments/authorizations/{current_authorization_id}/reauthorize` with a new `PayPal-Request-Id` and the milestone `amount` object.


* Parse the `HTTP 201 Created` response payload, read the newly minted `id` field, and atomically update the `active_authorization_id` foreign key on the milestone record while logging the superseded ID in the audit trail.


* Note that reauthorizing on Day 27 grants only a 2-day honor period before the hard Day 29 expiration. If a project extends past 29 days, automatically stage a replacement order or draft invoice (`create_invoice` with `PAY_BY_BANK` enabled and `generate_invoice_qr_code`).


* When updating an existing invoice via `update_invoicing`, always fetch the full invoice object via `get_invoice` first, merge the modified fields, and submit the complete object, because PayPal's invoice update performs a full replacement that overwrites omitted fields.



**3. Evidence-Gated Partial Capture & Voiding**
Once a milestone deliverable is verified and approved in the HITL console, invoke `POST /v2/payments/authorizations/{active_authorization_id}/capture` using the latest rotated ID. Set `final_capture: false` for intermediate milestones (or `true` for the final milestone), supporting partial captures or over-captures up to 115% or $75 USD above the original authorized amount. If a project is canceled, call `POST /v2/payments/authorizations/{active_authorization_id}/void` to release the buyer's hold immediately.

### Engine 3: Raw-Byte Webhook Gateway, HATEOAS Hydrator & Audit Vault

To eliminate the 3-hour delay on `/v1/reporting/transactions` and build an indisputable evidentiary record for digital and B2B deliveries, implement a two-stage ingestion and verification pipeline.

**1. Raw-Byte CRC32 Signature Verification**
Standard web framework JSON parsers strip whitespace or reorder keys, invalidating PayPal's webhook checksum. Configure your webhook route on Render to read the raw request byte buffer (`Buffer`) before parsing JSON:

* Compute the unsigned 32-bit CRC32 decimal value of the raw request body bytes.


* Read headers `PAYPAL-TRANSMISSION-ID`, `PAYPAL-TRANSMISSION-TIME`, `PAYPAL-CERT-URL`, and `PAYPAL-TRANSMISSION-SIG`, and assemble the string `<transmission_id>|<transmission_time>|<webhook_id>|<crc32_decimal>`.


* Download and cache the PEM certificate from `PAYPAL-CERT-URL` and verify the `PAYPAL-TRANSMISSION-SIG` signature using `RSA-SHA256`.


* Check the event `id` against Redis with a 7-day TTL (covering PayPal's 25-retry, 3-day delivery schedule) and immediately return `HTTP 200 OK`.



**2. Fast-Path HATEOAS State Hydration**
Because PayPal webhook payloads are compact (<10 KB) and the Transaction Search API lags by up to 3 hours without `updated_time` filtering, pass the verified webhook event to a **Render Workflow** worker. The worker extracts the `resource.links` array (`rel: "self"` or `rel: "up"`) and performs an immediate `GET` request against the authoritative REST endpoint (`/v2/checkout/orders/{id}`, `/v2/payments/captures/{id}`, `/v1/customer/disputes/{id}`, or `/v1/reporting/balances`) to hydrate the live state in AG Studio 3.

**3. Multimodal Proof-of-Delivery Indexing (Channel3 & Elastic)**
Before a contractor can request milestone capture, they upload completion artifacts (equipment photos, repository commit hashes, or signed delivery receipts):

* **Channel3 Verification:** For physical B2B supplies or hardware milestones, the agent queries the Channel3 MCP/REST endpoint with the item description or image to retrieve canonical SKU specs, retail pricing, and authentic product imagery across 100M+ catalog items.


* **Elastic Vector & Telemetry Vault:** Generate image embeddings of uploaded proof photos and run a kNN similarity query in Elasticsearch to confirm the image is not a duplicated or internet stock photo. Index a structured audit document in Elasticsearch containing the buyer's PayPal-registered email, full name, PayPal Transaction ID, Invoice ID, client preview IP address, download timestamps, checkout refund-policy acceptance, and SHA-256 deliverable hash.



### Engine 4: The 1.5% Dispute Ratio Shield & Multipart Evidence Compiler

When a `CUSTOMER.DISPUTE.CREATED` webhook arrives (covering `INTERNAL`, `EXTERNAL`, and `ALERT` channels), the system executes an automated triage and defense workflow.

**1. Rolling 90-Day Dispute Ratio Calculation**
Query `GET /v1/customer/disputes/{dispute_id}` to inspect `dispute_life_cycle_stage` (`INQUIRY` vs. `CHARGEBACK` / claim), `reason` (`MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED` / SNAD, `MERCHANDISE_OR_SERVICE_NOT_RECEIVED` / INR, or `UNAUTHORIZED`), `dispute_amount`, and `seller_response_due_date`. Calculate the merchant's rolling 3-month dispute ratio (`total_disputes_90d / total_sales_transactions_90d`).

**2. Branch A — Pre-Escalation Inquiry Settlement (`make-offer`)**
If `dispute_life_cycle_stage` is `INQUIRY` and `status` is `WAITING_FOR_SELLER_RESPONSE`, resolving the issue incurs a **$0 Dispute Fee** across both Standard and High Volume tiers, and un-escalated inquiries close automatically after 20 days. If the merchant's rolling ratio is approaching 1.5% (e.g., between 1.25% and 1.49% over 100+ transactions) and the disputed amount is low, avoiding escalation prevents the account from entering the High Volume tier where every future claim costs a non-refundable $30:

* The agent queries **Channel3** to identify an exact replacement item or calculates a partial settlement threshold.


* It stages a request to `POST /v1/customer/disputes/{id}/make-offer` with JSON body containing `note`, `offer_amount` (`currency_code` and `value`), and `offer_type` (`REFUND` or `REFUND_WITH_REPLACEMENT`).


* Once the merchant clicks approve in the HITL queue, SafeGate dispatches the offer, resolving the inquiry at $0 fee.



**3. Branch B — Escalated Claim Multipart Defense (`provide-evidence`)**
If the buyer escalates the dispute to a formal claim, direct buyer messaging is disabled and the merchant has a strict 10-day window (`seller_response_due_date`) to submit evidence before funds are permanently lost:

* The agent queries **Elasticsearch** using the disputed `transaction_id` to retrieve the pre-indexed chain of custody: signed Statement of Work, milestone approval timestamps, buyer IP access logs, download telemetry, and Channel3 spec verification.


* Using a server-side PDF generator, the engine compiles these artifacts into a single-orientation A4 PDF document strictly under 10 MB (with total upload payload under 50 MB) where every page header explicitly links the buyer's name, PayPal email, Transaction ID, and Invoice ID.


* To avoid `INVALID_EVIDENCE_FILE` errors caused by conflicting documentation between `multipart/related` and `multipart/form-data`, construct a standards-compliant `multipart/related; boundary=---AegisBoundary` request to `POST /v1/customer/disputes/{id}/provide-evidence`:


* Part 1 (`Content-Type: application/json`): Contains the `input` JSON metadata specifying `evidence_type: "PROOF_OF_FULFILLMENT"` (alongside `PROOF_OF_DELIVERY_SIGNATURE` or access records), `evidence_info` (tracking or digital access logs), and a structured defense `notes` summary.


* Part 2 (`Content-Type: application/pdf`, `Content-Disposition: form-data; name="file1"; filename="evidence.pdf"`): Contains the binary PDF buffer.




* Upon human approval in the AG Studio console, SafeGate submits the multipart payload and updates the dispute status on the Bryntum Calendar.



### Engine 5: Unified Visual Command Center & 1-Click Judge Demo Toolbar

**1. AG Studio 3 Treasury, Risk & HITL Console**
Implement the primary merchant view using **AG Studio 3**:

* **1.5% Dispute Ratio Gauge & Calculations UI:** Display live gross sales, net revenue after fees, rolling 90-day transaction count, and the current dispute ratio percentage, highlighting proximity to the 1.5% High Volume threshold.


* **Authorization Mutation Ledger:** Render a live grid of active milestone holds showing `order_id`, `original_authorization_id`, `current_authorization_id`, `honor_period_expires_at`, and `PayPal-Request-Id` UUIDs.


* **Studio Agent Framework & WebMCP:** Expose custom typed widgets so the AI agent and human operator share equal browser control via WebMCP—allowing the agent to dynamically construct anomaly widgets when refund spikes or overdue invoices occur.


* **Accessible HITL Decision Stamp:** Provide a WCAG-compliant, greyscale-safe approval drawer where managers inspect staged payloads and click **Approve & Execute** or **Reject**.



**2. Bryntum Gantt, Scheduler & Calendar Synchronization**
Embed **Bryntum Gantt** and **Bryntum Calendar** directly adjacent to the AG Studio ledger:

* **Payment-Driven Task Shifting:** Link each Bryntum Gantt milestone bar to its corresponding PayPal authorization or invoice state. When a webhook or Render Workflow signals a late payment, failed reauthorization, or open dispute, programmatically shift dependent downstream tasks forward on the Gantt timeline and flag affected staff allocations in **Bryntum Scheduler** so teams never work on unpaid phases.


* **10-Day Dispute Deadline Mapping:** Plot every open dispute's `seller_response_due_date` and every authorization's 3-day honor expiration onto **Bryntum Calendar**, automatically highlighting any 10-day dispute deadline that lacks assigned staff review time.



**3. The "1-Click Judge Demo Mode" Toolbar & Negative Testing**
Because judges review submissions between December 1 and December 15—and because PayPal Sandbox authorizations do not expire naturally after 29 days and Webhook Simulator payloads omit cryptographic signatures—build a persistent top toolbar labeled **Judge Demo Fixtures**:

* **Button 1 (Seed Contract & Lock Sandbox Hold):** Parses a pre-loaded B2B/Agency contract, populates Bryntum Gantt, and calls `POST /v2/checkout/orders` (`intent: "AUTHORIZE"`) using pre-configured Sandbox Business and Personal credentials.


* **Button 2 (Fast-Forward Day-3 Honor Period):** Triggers the Render Workflow to execute a live `POST /v2/payments/authorizations/{id}/reauthorize` call in the sandbox (or passes header `PayPal-Mock-Response` / `ENABLE_NEGATIVE_TESTING=true` to simulate hold expiration and failure cascades), visibly rotating the `authorization_id` in AG Studio and shifting tasks in Bryntum Gantt.


* **Button 3 (Verify Deliverable via Channel3 & Elastic):** Runs a live Channel3 catalog spec check and Elastic kNN verification, staging a partial capture in the HITL approval queue.


* **Button 4 (Simulate SNAD Dispute at 1.42% Ratio):** Injects a realistic dispute event, triggers the 1.5% threshold check, and lets the judge test both the 1-click `make-offer` settlement and the auto-compiled PDF `provide-evidence` submission.



## 4. End-to-End Execution Flows

### Flow 1: Contract-to-Escrow Initialization

1. Merchant selects a sample Statement of Work or uploads a contract in the UI.


2. The LLM extracts milestone deliverables, dates, and dollar splits using APIMatic-grounded schemas.


3. Bryntum Gantt renders the project task dependencies and resource timeline.


4. SafeGate invokes `POST /v2/checkout/orders` with `intent: "AUTHORIZE"` and a 36-character `PayPal-Request-Id`.


5. Sandbox buyer approves the hold; the raw-byte Webhook Gateway verifies the CRC32 signature and hydrates the order via HATEOAS links into AG Studio 3.



### Flow 2: Autonomous Day-3 Hold Renewal & Schedule Sync

1. Render Workflows tracks the 72-hour honor period timer for the active `authorization_id`.


2. Prior to Day 3 expiration, the workflow invokes `POST /v2/payments/authorizations/{id}/reauthorize` through SafeGate.


3. If successful, SafeGate captures the newly returned `authorization_id` and updates the active pointer in AG Studio 3.


4. If the reauthorization fails, the engine flags the hold in AG Studio and automatically shifts dependent downstream phases in Bryntum Gantt.



### Flow 3: Multimodal Proof Verification & Gated Capture

1. Contractor uploads deliverable photos and hardware/software completion artifacts.


2. The agent verifies physical item specs and pricing via Channel3 MCP and checks image authenticity via Elastic kNN embeddings.


3. Buyer preview IP, timestamps, and deliverable SHA-256 hashes are indexed in Elastic linked to the PayPal Transaction ID.


4. The agent stages `POST /v2/payments/authorizations/{active_id}/capture` inside the SafeGate HITL queue.


5. Merchant clicks **Approve & Execute** in AG Studio 3, settling the milestone funds in the PayPal Sandbox.



### Flow 4: 1.5% Cliff Triage & Automated Dispute Representment

1. Webhook Gateway receives `CUSTOMER.DISPUTE.CREATED`, hydrates `GET /v1/customer/disputes/{id}`, and plots the 10-day `seller_response_due_date` on Bryntum Calendar.


2. AG Studio 3 computes the rolling 90-day dispute ratio against the 1.5% High Volume threshold.


3. For pre-escalation inquiries near 1.5%, the agent checks Channel3 replacement pricing and stages `POST /v1/customer/disputes/{id}/make-offer` ($0 dispute fee) for human approval.


4. For escalated SNAD/INR claims, the agent queries Elastic for the transaction-linked audit trail and generates a compliant <10 MB A4 PDF.


5. Upon 1-click HITL approval, SafeGate fires the multipart `POST /v1/customer/disputes/{id}/provide-evidence` request to win the claim.


6. **Multipart Evidence Dispatch:** Upon 1-click HITL approval in AG Studio 3, SafeGate constructs a multipart request to the PayPal Customer Disputes API provide-evidence endpoint. It attaches the JSON metadata and the binary PDF buffer to win the claim ahead of the 10-day deadline.



### Flow 5: Pre-Flight Subcontractor Payouts & 30-Day Unclaimed Lock Recovery

1. **Multi-Currency Balance Check:** Once a milestone capture settles, the agent queries the PayPal Reporting Balances endpoint across currencies. This prevents batch payout rejections caused by insufficient funds.


2. **Pre-Flight Schema Validation:** Using APIMatic-grounded schemas, the engine validates UTF-8 encoding, decimal string formatting, and unique batch identifiers under 63 characters. It paces outbound requests below the 400 POST requests per minute rate limit.


3. **Fuzzy Recipient Verification:** Before dispatching funds, the agent runs an Elastic fuzzy match against historical invoices and tax records to catch irreversible recipient email typos.


4. **Unclaimed Capital Recovery:** If a payout item enters an unclaimed state because a recipient email is unregistered, the system alerts the recipient via Zapier MCP. If unconfirmed within 48 hours, it invokes the cancel payout item endpoint so working capital is freed in 2 days instead of locked for 30 days.



## 5. Sandbox Simulation, Negative Testing & Postman Audit Implementation

Judges evaluate projects between December 1 and December 15, nearly three weeks after the November submission cutoff. Because PayPal Sandbox authorizations do not expire naturally after 29 days and Webhook Simulator events do not support cryptographic signature verification, your implementation must include deterministic test fixtures.

**Dual-Sandbox Account & Cross-Border Setup**
Configure both a PayPal Sandbox Business account (representing the agency or B2B merchant) and a Sandbox Personal account (representing the client buyer) inside the developer portal. Store both credential sets in backend environment variables so the hosted application executes authenticated sandbox calls without prompting judges to log in or supply their own keys. For cross-border fee and currency spread demonstrations, configure a secondary buyer account in a foreign currency corridor.

**Simulating Lifecycle Cliffs via Negative Testing Headers**
To demonstrate expired holds, failed captures outside the 3-day honor period, and dispute transitions on demand, inject PayPal's negative testing headers (`PayPal-Mock-Response` and `ENABLE_NEGATIVE_TESTING` set to true) inside your SafeGate test harness. When a judge clicks the fast-forward simulation button in the UI toolbar, the backend routes a live reauthorization request to the sandbox to generate a real rotated authorization ID, or attaches a mock error header to trigger the Bryntum Gantt task-shifting cascade.

**Signed vs. Simulated Webhook Dual-Mode Handler**
In your webhook ingestion endpoint on Render, implement dual-path verification. For live sandbox events triggered by real order authorizations or captures, run the full raw-byte CRC32 calculation and RSA-SHA256 certificate verification against the PayPal transmission headers. For synthetic dispute events injected via the Judge Demo toolbar or PayPal Webhook Simulator (which lack verifiable cryptographic signatures), authenticate the request using an internal HMAC demo token and route the payload into the exact same HATEOAS hydration worker.

**Public Postman Workspace & Collection Integration**
To appeal to judge Pooja Mistry (Senior Developer Advocate at Postman) and provide zero-friction auditability, export a public Postman Collection linked in your repository and UI. Pre-configure collection variables with sandbox test fixtures covering four core sequences:

* **Sequence 1:** Two-step order creation, authorization lock, and Day-3 reauthorization showing the mutated identifier.


* **Sequence 2:** Idempotent refund and capture replay verification using a 36-character UUID in the request header.


* **Sequence 3:** Pre-escalation inquiry settlement offer dispatch at zero dispute fee.


* **Sequence 4:** Multipart PDF evidence upload for a Significantly Not As Described claim.



## 6. Cloud Deployment, Repository Hygiene & Compliance Architecture

With six PayPal judges on the panel—including open-source advocate Eddie Jaoude, frontend specialist Jo Franchetti, and engineering leaders Himraj Singh and Karthik Ravi—strict compliance with Devpost rules and engineering hygiene is mandatory.

**Render Cloud & Workflows Deployment**
Deploy the application on Render using the $50 hackathon credits. Provision three connected services inside a single Render blueprint:

* **Web Service:** Hosts the frontend command center (AG Studio 3 and Bryntum) and the SafeGate API proxy. Keep the instance active during the December 1–15 judging window so cold starts never stall a judge's 5-minute audit.


* **Render Workflows Worker:** Executes the durable 72-hour authorization honor-period timers, HATEOAS state hydration, and asynchronous PDF evidence compilation.


* **Redis Instance:** Stores the 7-day TTL webhook event deduplication keys and the 36-character idempotency response snapshots.



**Open-Source License Disqualifier Protection**
Devpost rules strictly require a public repository on GitHub, GitLab, or Bitbucket with an open-source license visible at the top of the repo in the About section. Place a standard MIT or Apache-2.0 license file in the root directory of your repository on day one so GitHub automatically populates the license badge in the top-right About sidebar.

**Credential Hygiene & Accessibility Standards**
Never commit client secrets, static access tokens, or account identifiers to source control. Provide a documented example environment template and manage runtime secrets exclusively through Render environment groups. On the frontend, ensure all custom AG Studio 3 widgets, Bryntum timelines, and the Human-in-the-Loop approval modal meet WCAG accessibility standards with keyboard navigation and greyscale-safe visual status indicators.

## 7. The 72-Hour Build Schedule & 170-Second Video Execution Plan

To ship a complete, working build before the deadline on Thursday, November 12, 2026 at 12:00 PM PST (Friday, November 13, 2026 at 1:30 AM IST), execute the build in four sequential phases.

| Sprint Window | Primary Engineering Deliverable | Verification Milestone |
| --- | --- | --- |
| Hours 0 to 12 | SafeGate Proxy, OAuth manager, APIMatic grounding, and PayPal Sandbox setup | Live authorize, reauthorize, make-offer, and provide-evidence calls succeed |
| Hours 12 to 30 | AG Studio 3 console, Bryntum Gantt/Calendar sync, and HITL approval drawer | Rotated authorization IDs and 1.5% dispute gauge update live on screen |
| Hours 30 to 48 | Channel3 spec check, Elastic kNN audit vault, PDF bundler, and Render deploy | Hosted Render URL executes all 4 Judge Demo fixture buttons end to end |
| Hours 48 to 68 | Public Postman workspace, root license verification, README, and video capture | Video under 3:00 uploaded to YouTube and Devpost form locked 4 hours early |

**Video Production & Compliance Rules**
Presentation is one of the five main judging pillars and carries a dedicated $5,000 Best Demo Delivery prize. Keep the video strictly under 3 minutes (targeting 2 minutes and 50 seconds), upload it publicly to YouTube, record the actual working build on screen, and exclude all copyrighted background music or unauthorized third-party brand logos.

* **0:00 to 0:25 (The Data Hook):** Open directly in the live PayPal Aegis interface. State the core problem clearly: service and B2B milestone sellers lack physical tracking barcodes, face 3-day authorization honor cliffs where reauthorizing mutates the ID, risk crossing the 1.5% High Volume dispute ratio threshold ($30 non-refundable fee), and use a PayPal Agent Toolkit that can surrender disputes (`accept_dispute_claim`) but lacks tools to defend them.


* **0:25 to 1:45 (Live End-to-End Walkthrough):** Trigger the Judge Demo fixtures live. Show the AI parsing a contract into Bryntum Gantt and locking a PayPal authorization hold. Fire the Render Workflow Day-3 reauthorization and show AG Studio 3 catching the newly rotated authorization ID with a 36-character idempotency key. Verify a milestone deliverable via Channel3 and Elastic, click Approve in the HITL gate to capture funds, and then trigger a simulated SNAD dispute—showing both the $0 fee pre-escalation settlement offer near 1.5% and the 1-click multipart PDF evidence upload.


* **1:45 to 2:25 (Architecture & Sponsor Stack):** Display the architectural flow showing how the APIMatic Context Plugin grounded the v1/v2 schemas, how SafeGate enforces sandbox isolation and HITL security, and how Render Workflows coordinates raw-byte CRC32 webhooks and hold timers.


* **2:25 to 2:50 (Impact Summary & Judge Audit Invitation):** Highlight the 1-Click Judge Demo toolbar on the live Render URL and the public Postman collection so judges can audit every flow in under 60 seconds.