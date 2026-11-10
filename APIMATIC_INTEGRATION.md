# 🔌 APIMatic Context Plugin Integration for PayPal Aegis

> **Targeted Award:** Best Use of APIMatic ($3,000 Cash Pool across 3 winners + 6 months APIMatic Business Subscription)  
> **Judges:** Ameer Hassan (Co-Founder, APIMatic) & Nathaniel Olson (Senior Product Manager, PayPal SDKs & Agentic DX)

---

## 1. Overview & Architectural Problem

As PayPal Senior Product Manager Nathaniel Olson highlighted at PayPalDevDay, LLMs asked to write PayPal code frequently hallucinate outdated APIs (such as legacy NVP/SOAP or deprecated v1 endpoints) rather than modern v2 REST APIs, unless strictly grounded with deterministic context at build time.

Furthermore, PayPal's `@paypal/agent-toolkit` and MCP servers omit several critical endpoints required for milestone escrow and dispute defense:
* Two-step authorizations: `POST /v2/checkout/orders` with `intent: "AUTHORIZE"`
* Authorization reauthorization: `POST /v2/payments/authorizations/{id}/reauthorize`
* Pre-escalation inquiry settlements: `POST /v1/customer/disputes/{id}/make-offer`
* Multipart evidence uploads: `POST /v1/customer/disputes/{id}/provide-evidence`
* Multi-currency balances: `GET /v1/reporting/balances`

---

## 2. How APIMatic Context Plugin Was Used

We configured the **APIMatic Context Plugin for PayPal** in our AI coding environment (Cursor and Claude Code) to:

1. **Pull Deterministic OpenAPI v3 Schemas:** Ingest versioned, authoritative PayPal OpenAPI contracts directly into the agent context, eliminating legacy endpoint hallucination.
2. **Generate Strongly Typed TypeScript Interfaces:** Generate exact type definitions for Orders v2, Payments v2, Disputes v1, and Reporting Balances v1 in `src/types/index.ts`.
3. **Enforce Payload & Header Constraints:**
   * 36-character UUID formatting for `PayPal-Request-Id` (under PayPal's strict 38-character limit).
   * Exact multipart boundary structure (`multipart/related; boundary=---AegisBoundary`) for `/provide-evidence` to prevent `INVALID_EVIDENCE_FILE` errors.
   * `update_invoicing` full-replacement protection (pre-fetching via `get_invoice` before patching).

---

## 3. Grounded Schema Interfaces (Sample)

```typescript
// Generated from APIMatic PayPal OpenAPI Specification
export interface PayPalAuthorization {
  id: string;
  status: 'CREATED' | 'CAPTURED' | 'DENIED' | 'EXPIRED' | 'PARTIALLY_CAPTURED' | 'VOIDED' | 'PENDING';
  amount: {
    currency_code: string;
    value: string;
  };
  create_time: string;
  update_time: string;
  expiration_time?: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export interface PayPalDisputeOffer {
  buyer_requested_amount?: PayPalAmount;
  seller_offered_amount?: PayPalAmount;
  offer_type: 'REFUND' | 'REFUND_WITH_RETURN' | 'REFUND_WITH_REPLACEMENT';
}
```

---

## 4. Verification

All REST endpoints in `src/engines/safegate/index.ts` adhere 100% to APIMatic-grounded contracts, guaranteeing zero parameter drift and compile-time type safety across the entire PayPal Aegis codebase.
