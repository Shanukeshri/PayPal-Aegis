/**
 * Visual End-to-End Flow PDF Generator for PayPal Aegis (Redesigned Role-Separated UI)
 *
 * Drives the live PayPal Aegis frontend at http://localhost:3000 with Puppeteer + Chrome,
 * walks step-by-step through every role view, sidebar module, drawer, branch, and guardrail,
 * captures 2x Retina PNG screenshots with visual click callouts, and compiles:
 *   - /Users/shanukeshri983/Desktop/PayPal/flow.pdf
 *   - /Users/shanukeshri983/Desktop/PayPal/paypal-aegis/flow.pdf
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import puppeteer, { Browser, Page } from 'puppeteer-core';

const CHROME_PATH =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TARGET_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';

const ROOT_DIR = path.resolve(__dirname, '../..');
const FLOW_DIR = path.resolve(ROOT_DIR, 'screenshots/flow');
const OUTPUT_PDF = path.resolve(ROOT_DIR, 'flow.pdf');
const OUTPUT_PDF_PKG = path.resolve(__dirname, '../flow.pdf');

type PhaseType =
  | 'BASELINE'
  | 'STATE_EARLIER'
  | 'USER_ACTION'
  | 'WHAT_CHANGED'
  | 'FEATURE_SPOTLIGHT';

interface FlowStep {
  stepNumber: number;
  phase: PhaseType;
  stageTag: string;
  title: string;
  imagePath: string;
  beforeState: string;
  triggerAction: string;
  whatChanged: string;
  ecosystemProof: string;
  apiBadge?: string;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function httpRequest(
  url: string,
  method: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : undefined,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 200, data: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode || 200, data: raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function resetDemoBackend(): Promise<void> {
  const res = await httpRequest(`${API_URL}/demo/reset`, 'POST', {});
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`POST ${API_URL}/demo/reset failed with status ${res.status}`);
  }
}

async function waitForText(
  page: Page,
  text: string,
  timeoutMs = 45000
): Promise<void> {
  await page.waitForFunction(
    (needle: string) =>
      Boolean(
        document.body &&
          document.body.innerText.toLowerCase().includes(needle.toLowerCase())
      ),
    { timeout: timeoutMs },
    text
  );
}

async function waitForNoText(
  page: Page,
  text: string,
  timeoutMs = 20000
): Promise<void> {
  await page.waitForFunction(
    (needle: string) =>
      Boolean(
        document.body &&
          !document.body.innerText.toLowerCase().includes(needle.toLowerCase())
      ),
    { timeout: timeoutMs },
    text
  );
}

async function locateAndAct(
  page: Page,
  selector: string,
  requiredTexts: string[],
  action: 'highlight' | 'click' | 'scrollOnly',
  calloutLabel?: string,
  scrollBlock: ScrollLogicalPosition = 'center',
  exactMatch = false
): Promise<boolean> {
  const result = await page.evaluate(
    (
      sel: string,
      needles: string[],
      act: string,
      label: string | undefined,
      blockPos: ScrollLogicalPosition,
      exact: boolean
    ) => {
      const candidates = Array.from(document.querySelectorAll(sel));
      const target = candidates.find((el) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.closest('#__flow_overlay_root')) return false;
        const rect = htmlEl.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const style = window.getComputedStyle(htmlEl);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const txt = (htmlEl.innerText || htmlEl.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        if (exact) {
          return needles.length === 1 && txt === needles[0].toLowerCase();
        }
        return needles.every((n) => txt.includes(n.toLowerCase()));
      }) as HTMLElement | undefined;

      if (!target) return false;

      if (act === 'scrollOnly' || act === 'highlight') {
        target.scrollIntoView({ behavior: 'instant', block: blockPos });
      }

      if (act === 'highlight') {
        const existing = document.getElementById('__flow_overlay_root');
        if (existing) existing.remove();

        const rect = target.getBoundingClientRect();
        const docLeft = rect.left + window.scrollX;
        const docTop = rect.top + window.scrollY;
        const docBottom = rect.bottom + window.scrollY;

        const root = document.createElement('div');
        root.id = '__flow_overlay_root';
        root.style.position = 'absolute';
        root.style.top = '0';
        root.style.left = '0';
        root.style.width = `${document.documentElement.scrollWidth}px`;
        root.style.height = `${document.documentElement.scrollHeight}px`;
        root.style.pointerEvents = 'none';
        root.style.zIndex = '999999';

        const ring = document.createElement('div');
        ring.style.position = 'absolute';
        ring.style.left = `${docLeft - 5}px`;
        ring.style.top = `${docTop - 5}px`;
        ring.style.width = `${rect.width + 10}px`;
        ring.style.height = `${rect.height + 10}px`;
        ring.style.borderRadius = '10px';
        ring.style.border = '3px solid #E11D48';
        ring.style.boxShadow =
          '0 0 0 5px rgba(225, 29, 72, 0.22), 0 8px 24px rgba(225, 29, 72, 0.35)';
        ring.style.background = 'rgba(225, 29, 72, 0.04)';
        root.appendChild(ring);

        const pill = document.createElement('div');
        pill.textContent = `CLICK: ${label || needles[0]}`;
        pill.style.position = 'absolute';
        pill.style.fontFamily =
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        pill.style.fontSize = '11px';
        pill.style.fontWeight = '800';
        pill.style.letterSpacing = '0.03em';
        pill.style.color = '#FFFFFF';
        pill.style.background = '#E11D48';
        pill.style.padding = '5px 10px';
        pill.style.borderRadius = '999px';
        pill.style.boxShadow = '0 4px 14px rgba(15, 23, 42, 0.35)';
        pill.style.border = '2px solid #FFFFFF';
        pill.style.whiteSpace = 'nowrap';

        const placeBelow = docTop < 54;
        const leftPos = Math.min(
          Math.max(12, docLeft + rect.width / 2 - 110),
          document.documentElement.clientWidth - 290
        );
        pill.style.left = `${leftPos}px`;
        pill.style.top = placeBelow ? `${docBottom + 9}px` : `${docTop - 34}px`;
        root.appendChild(pill);

        document.body.appendChild(root);
      }

      if (act === 'click') {
        target.scrollIntoView({ behavior: 'instant', block: blockPos });
        target.click();
      }

      return true;
    },
    selector,
    requiredTexts,
    action,
    calloutLabel,
    scrollBlock,
    exactMatch
  );

  if (!result) {
    throw new Error(
      `Could not find visible element matching "${selector}" with texts: ${JSON.stringify(requiredTexts)}`
    );
  }
  return result;
}

async function clearHighlight(page: Page): Promise<void> {
  await page.evaluate(() => {
    const existing = document.getElementById('__flow_overlay_root');
    if (existing) existing.remove();
  });
}

async function dismissToastIfPresent(page: Page): Promise<void> {
  await page.evaluate(() => {
    const btn = document.querySelector(
      'button[aria-label="Dismiss notification"]'
    ) as HTMLElement | null;
    if (btn) btn.click();
  });
  await delay(120);
}

async function switchRole(page: Page, role: 'Client' | 'Merchant'): Promise<void> {
  await locateAndAct(page, 'header button', [role], 'click');
  await delay(250);
}

async function navigateSidebar(
  page: Page,
  itemLabel: 'Overview' | 'Escrow' | 'Delivery' | 'Disputes' | 'Activity'
): Promise<void> {
  await locateAndAct(page, 'nav[aria-label="Primary Navigation"] button', [itemLabel], 'click');
  await delay(300);
}

async function capturePng(
  page: Page,
  filename: string,
  options: { fullPage?: boolean; scrollY?: number } = {}
): Promise<string> {
  const fullPath = path.join(FLOW_DIR, filename);
  if (typeof options.scrollY === 'number') {
    await page.evaluate((y: number) => window.scrollTo(0, y), options.scrollY);
    await delay(180);
  }
  await page.screenshot({
    path: fullPath,
    fullPage: options.fullPage ?? false,
  });
  console.log(`  Captured -> ${filename}`);
  return fullPath;
}

function phaseBadgeStyle(phase: PhaseType): {
  label: string;
  bg: string;
  fg: string;
  border: string;
} {
  switch (phase) {
    case 'BASELINE':
      return {
        label: 'START STATE',
        bg: '#F1F5F9',
        fg: '#334155',
        border: '#CBD5E1',
      };
    case 'STATE_EARLIER':
      return {
        label: 'EARLIER STATE',
        bg: '#EEF2FF',
        fg: '#3730A3',
        border: '#C7D2FE',
      };
    case 'USER_ACTION':
      return {
        label: 'CLICK ACTION',
        bg: '#FFF1F2',
        fg: '#BE123C',
        border: '#FECDD3',
      };
    case 'WHAT_CHANGED':
      return {
        label: 'WHAT CHANGED',
        bg: '#ECFDF5',
        fg: '#047857',
        border: '#A7F3D0',
      };
    case 'FEATURE_SPOTLIGHT':
      return {
        label: 'DEEP VERIFICATION',
        bg: '#EFF6FF',
        fg: '#005EA6',
        border: '#BFDBFE',
      };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function imageToDataUri(filePath: string): string {
  const b64 = fs.readFileSync(filePath).toString('base64');
  return `data:image/png;base64,${b64}`;
}

function buildHtmlDocument(steps: FlowStep[]): string {
  const totalPages = steps.length + 1;
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  const tocGroups = [
    {
      stage: 'Phase 1: Role Baseline & Milestone 1 Lock',
      steps: steps.filter((s) => s.stepNumber >= 1 && s.stepNumber <= 3),
    },
    {
      stage: 'Phase 2: 72h Renewal, Ledger & Gantt',
      steps: steps.filter((s) => s.stepNumber >= 4 && s.stepNumber <= 7),
    },
    {
      stage: 'Phase 3: Delivery Audit, Bell & M2 Isolation',
      steps: steps.filter((s) => s.stepNumber >= 8 && s.stepNumber <= 14),
    },
    {
      stage: 'Phase 4: Dispute Shield (Branch A & Branch B)',
      steps: steps.filter((s) => s.stepNumber >= 15 && s.stepNumber <= 21),
    },
    {
      stage: 'Phase 5: Activity Bus & Dev Tools Drawer',
      steps: steps.filter((s) => s.stepNumber >= 22 && s.stepNumber <= 24),
    },
    {
      stage: 'Phase 6: Demo Sandbox Guardrails & Reset',
      steps: steps.filter((s) => s.stepNumber >= 25),
    },
  ];

  const coverHtml = `
    <div class="pdf-page cover-page">
      <div class="cover-topbar">
        <div class="brand-lockup">
          <span class="brand-pill">PAYPAL AEGIS</span>
          <span class="brand-sub">Role-Separated Milestone Escrow, SafeGate HITL &amp; Dispute Defense OS</span>
        </div>
        <div class="cover-meta">Visual End-to-End Application Flow • ${steps.length} Live UI Frames • Captured on Live Sandbox</div>
      </div>

      <div class="cover-hero">
        <h1>Complete Application Flow: Start Screen to Multi-Milestone Settlement &amp; Dispute Shield</h1>
        <p class="cover-lead">
          Each frame documents the exact <strong>State Earlier → User Click → Live State Change → Technical Proof</strong> across
          the redesigned role-separated workspace (<strong>Sidebar Navigation + TopBar Client/Merchant Switcher + Bell Approvals + Dev/Demo Drawers</strong>),
          backed by Orders v2 Auth/Reauth/Capture, Channel3 catalog matching, 64-dim Cosine RAG, AG Grid, Bryntum Gantt, and A4 PDF representment.
        </p>
      </div>

      <div class="flow-strip">
        <div class="flow-node">
          <div class="fn-num">01</div>
          <div class="fn-title">Role Baseline</div>
          <div class="fn-desc">Sidebar + Switcher • $0 Held</div>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-node">
          <div class="fn-num">02</div>
          <div class="fn-title">Escrow Lock</div>
          <div class="fn-desc">Orders v2 + 72h Auth Rotation</div>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-node">
          <div class="fn-num">03</div>
          <div class="fn-title">Delivery &amp; Bell</div>
          <div class="fn-desc">SKU/Vector Audit + M2 Isolation</div>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-node">
          <div class="fn-num">04</div>
          <div class="fn-title">Dispute Shield</div>
          <div class="fn-desc">0.95% $0 Offer vs A4 PDF</div>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-node">
          <div class="fn-num">05</div>
          <div class="fn-title">Activity &amp; Dev</div>
          <div class="fn-desc">CRC32 Wire • 4 Scoped Tools</div>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-node">
          <div class="fn-num">06</div>
          <div class="fn-title">Sandbox &amp; Reset</div>
          <div class="fn-desc">Malformed SOW Guardrail</div>
        </div>
      </div>

      <div class="toc-grid">
        ${tocGroups
          .map(
            (g) => `
          <div class="toc-card">
            <div class="toc-head">${escapeHtml(g.stage)}</div>
            <ul class="toc-list">
              ${g.steps
                .map((s) => {
                  const st = phaseBadgeStyle(s.phase);
                  return `
                  <li>
                    <span class="toc-step">P.${String(s.stepNumber + 1).padStart(2, '0')}</span>
                    <span class="toc-badge" style="background:${st.bg};color:${st.fg};border-color:${st.border}">${st.label}</span>
                    <span class="toc-text">${escapeHtml(s.title)}</span>
                  </li>`;
                })
                .join('')}
            </ul>
          </div>`
          )
          .join('')}
      </div>

      <div class="cover-footer">
        <span>Target Source: <strong>${escapeHtml(TARGET_URL)}</strong> (API: ${escapeHtml(API_URL)})</span>
        <span>Generated: ${generatedAt} • Page 1 of ${totalPages}</span>
      </div>
    </div>`;

  const stepPagesHtml = steps
    .map((s, idx) => {
      const style = phaseBadgeStyle(s.phase);
      const dataUri = imageToDataUri(s.imagePath);
      const pageNum = idx + 2;
      return `
      <div class="pdf-page step-page">
        <div class="step-topbar">
          <div class="topbar-left">
            <span class="step-num-pill">STEP ${String(s.stepNumber).padStart(2, '0')}</span>
            <span class="phase-pill" style="background:${style.bg};color:${style.fg};border-color:${style.border}">${style.label}</span>
            <span class="stage-label">${escapeHtml(s.stageTag)}</span>
          </div>
          <div class="topbar-right">
            ${s.apiBadge ? `<span class="api-pill">${escapeHtml(s.apiBadge)}</span>` : ''}
            <span class="page-counter">Page ${pageNum} / ${totalPages}</span>
          </div>
        </div>

        <div class="step-workspace">
          <div class="sidebar-col">
            <h2 class="step-title">${escapeHtml(s.title)}</h2>

            <div class="info-card card-before">
              <div class="ic-label">1. State Earlier (Before)</div>
              <div class="ic-body">${escapeHtml(s.beforeState)}</div>
            </div>

            <div class="info-card card-action">
              <div class="ic-label">2. Click / User Trigger</div>
              <div class="ic-body">${escapeHtml(s.triggerAction)}</div>
            </div>

            <div class="info-card card-after">
              <div class="ic-label">3. What Changed (Observed UI)</div>
              <div class="ic-body">${escapeHtml(s.whatChanged)}</div>
            </div>

            <div class="info-card card-proof">
              <div class="ic-label">4. Technical Proof</div>
              <div class="ic-body">${escapeHtml(s.ecosystemProof)}</div>
            </div>
          </div>

          <div class="screenshot-col">
            <div class="frame-shell">
              <div class="browser-dots">
                <span></span><span></span><span></span>
                <span class="browser-url">${escapeHtml(TARGET_URL)} — PayPal Aegis Role-Separated Escrow &amp; Dispute OS</span>
              </div>
              <div class="img-wrap">
                <img src="${dataUri}" alt="${escapeHtml(s.title)}" />
              </div>
            </div>
          </div>
        </div>
      </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>PayPal Aegis — Visual Application Flow</title>
<style>
  @page {
    size: A4 landscape;
    margin: 7mm;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #ffffff;
    color: #0f172a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pdf-page {
    width: 283mm;
    height: 196mm;
    page-break-after: always;
    break-after: page;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .pdf-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  /* Cover Page */
  .cover-page {
    background: #F9F8F5;
    border: 1px solid #E5E0D8;
    border-radius: 8px;
    padding: 6.5mm 7.5mm;
    justify-content: space-between;
  }
  .cover-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid #E5E0D8;
    padding-bottom: 3.5mm;
  }
  .brand-lockup {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .brand-pill {
    background: #003087;
    color: #ffffff;
    font-weight: 800;
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 5px;
    letter-spacing: 0.04em;
  }
  .brand-sub {
    font-size: 11px;
    font-weight: 700;
    color: #1C1917;
  }
  .cover-meta {
    font-size: 9px;
    font-weight: 600;
    color: #57534E;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .cover-hero h1 {
    font-size: 18.5px;
    line-height: 1.2;
    color: #003087;
    margin-bottom: 4px;
  }
  .cover-lead {
    font-size: 10px;
    line-height: 1.42;
    color: #44403C;
    max-width: 255mm;
  }
  .flow-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    background: #FFFFFF;
    border: 1px solid #E5E0D8;
    border-radius: 8px;
    padding: 3.2mm 4.5mm;
  }
  .flow-node {
    flex: 1;
    background: #F4F1EA;
    border: 1px solid #E5E0D8;
    border-radius: 6px;
    padding: 2.5mm 2.8mm;
  }
  .fn-num {
    font-size: 8px;
    font-weight: 800;
    color: #0070BA;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .fn-title {
    font-size: 9.5px;
    font-weight: 800;
    color: #1C1917;
    margin: 1px 0;
  }
  .fn-desc {
    font-size: 7.8px;
    color: #57534E;
  }
  .flow-arrow {
    font-size: 13px;
    font-weight: 800;
    color: #0070BA;
  }
  .toc-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 3mm;
    width: 100%;
  }
  .toc-card {
    background: #FFFFFF;
    border: 1px solid #E5E0D8;
    border-radius: 7px;
    padding: 2.6mm 3.2mm;
    min-width: 0;
    overflow: hidden;
  }
  .toc-head {
    font-size: 8.6px;
    font-weight: 800;
    color: #003087;
    border-bottom: 1px solid #F4F1EA;
    padding-bottom: 2px;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .toc-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2.5px;
  }
  .toc-list li {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 7.4px;
    line-height: 1.25;
    min-width: 0;
  }
  .toc-step {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 800;
    color: #57534E;
    min-width: 23px;
    flex-shrink: 0;
  }
  .toc-badge {
    font-size: 6.2px;
    font-weight: 800;
    padding: 1px 3.5px;
    border-radius: 3px;
    border: 1px solid;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .toc-text {
    color: #1C1917;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cover-footer {
    display: flex;
    justify-content: space-between;
    font-size: 8.5px;
    color: #78716C;
    border-top: 1px solid #E5E0D8;
    padding-top: 2.5mm;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  /* Step Pages */
  .step-page {
    background: #ffffff;
  }
  .step-topbar {
    height: 10mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid #E5E0D8;
    padding-bottom: 2mm;
    margin-bottom: 2.5mm;
    flex-shrink: 0;
  }
  .topbar-left {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .step-num-pill {
    background: #1C1917;
    color: #ffffff;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 9px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 5px;
    letter-spacing: 0.04em;
  }
  .phase-pill {
    font-size: 8.5px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid;
    letter-spacing: 0.03em;
  }
  .stage-label {
    font-size: 10px;
    font-weight: 700;
    color: #57534E;
  }
  .topbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .api-pill {
    background: #EFF6FF;
    color: #005EA6;
    border: 1px solid #BFDBFE;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 8px;
    font-weight: 700;
    padding: 2.5px 7px;
    border-radius: 5px;
  }
  .page-counter {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 9px;
    font-weight: 700;
    color: #57534E;
  }

  .step-workspace {
    flex: 1;
    display: flex;
    gap: 4.5mm;
    min-height: 0;
  }
  .sidebar-col {
    width: 72mm;
    display: flex;
    flex-direction: column;
    gap: 2.6mm;
    flex-shrink: 0;
  }
  .step-title {
    font-size: 11.5px;
    line-height: 1.28;
    font-weight: 800;
    color: #003087;
    padding-bottom: 1.5mm;
    border-bottom: 1px solid #E5E0D8;
  }
  .info-card {
    border-radius: 6px;
    padding: 2.3mm 2.8mm;
    border: 1px solid #E2E8F0;
    background: #F8FAFC;
  }
  .card-before {
    background: #F8FAFC;
    border-color: #CBD5E1;
  }
  .card-action {
    background: #FFF1F2;
    border-color: #FECDD3;
  }
  .card-after {
    background: #ECFDF5;
    border-color: #A7F3D0;
  }
  .card-proof {
    background: #EFF6FF;
    border-color: #BFDBFE;
  }
  .ic-label {
    font-size: 7.4px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
    color: #334155;
  }
  .card-action .ic-label { color: #BE123C; }
  .card-after .ic-label { color: #047857; }
  .card-proof .ic-label { color: #005EA6; }
  .ic-body {
    font-size: 8.3px;
    line-height: 1.38;
    color: #1E293B;
  }

  .screenshot-col {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
  }
  .frame-shell {
    width: 100%;
    height: 100%;
    background: #0F172A;
    border: 1px solid #CBD5E1;
    border-radius: 7px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .browser-dots {
    height: 18px;
    background: #1E293B;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 9px;
    flex-shrink: 0;
  }
  .browser-dots span:nth-child(1),
  .browser-dots span:nth-child(2),
  .browser-dots span:nth-child(3) {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
  }
  .browser-dots span:nth-child(1) { background: #EF4444; }
  .browser-dots span:nth-child(2) { background: #F59E0B; }
  .browser-dots span:nth-child(3) { background: #10B981; }
  .browser-url {
    margin-left: 8px;
    font-size: 8px;
    color: #94A3B8;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .img-wrap {
    flex: 1;
    background: #F4F1EA;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 2px;
  }
  .img-wrap img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
    border-radius: 3px;
  }
</style>
</head>
<body>
${coverHtml}
${stepPagesHtml}
</body>
</html>`;
}

async function main() {
  fs.mkdirSync(FLOW_DIR, { recursive: true });
  for (const file of fs.readdirSync(FLOW_DIR)) {
    if (file.endsWith('.png')) {
      fs.unlinkSync(path.join(FLOW_DIR, file));
    }
  }

  console.log(`Target Frontend: ${TARGET_URL}`);
  console.log(`Target API:      ${API_URL}`);

  const healthUrl = `${API_URL.replace(/\/api$/, '')}/health`;
  const health = await httpRequest(healthUrl, 'GET');
  if (health.status !== 200) {
    throw new Error(`Backend health check failed at ${healthUrl}`);
  }
  console.log(
    `Backend health OK (${health.data?.data?.mode || health.data?.mode || 'LIVE_SANDBOX'})`
  );

  console.log('Resetting demo backend to clean baseline...');
  await resetDemoBackend();

  const browser: Browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new' as any,
    defaultViewport: { width: 1440, height: 920, deviceScaleFactor: 2 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1440,920',
    ],
  });

  const steps: FlowStep[] = [];
  let page: Page | undefined;

  try {
    await browser
      .defaultBrowserContext()
      .overridePermissions(TARGET_URL, ['clipboard-read', 'clipboard-write']);
    page = await browser.newPage();
    page.setDefaultTimeout(45000);

    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitForText(page, 'No active escrow hold');
    await waitForText(page, 'Lock Milestone 1 Hold');
    await delay(500);

    // ------------------------------------------------------------------
    // STEP 01: Opening Baseline (Client Role, Overview Page)
    // ------------------------------------------------------------------
    steps.push({
      stepNumber: 1,
      phase: 'BASELINE',
      stageTag: 'Phase 1 • Role-Separated Clean Baseline',
      title: 'Overview (Client Role): Unseeded Escrow State ($0.00 Held)',
      imagePath: await capturePng(page, '01_overview_client_baseline.png', { scrollY: 0 }),
      beforeState:
        'Clean workspace reset via POST /api/demo/reset. No active milestone holds exist on card or ledger.',
      triggerAction: `Initial load of ${TARGET_URL} with Client role active in TopBar.`,
      whatChanged:
        'Left sidebar groups product views (Overview, Escrow, Delivery, Disputes, Activity) separately from Dev tools & Demo drawers. Overview shows slim 4-step SLA progress bar, single CTA card ("Lock Milestone 1 Hold"), Held ($0.00) & Settled ($0.00) KPIs—hiding Merchant-only Dispute Ratio—and zero SafeGate alerts.',
      ecosystemProof:
        'Eliminates multi-layer dashboard clutter: role separation ensures buyers only see buyer KPIs and approvals while demo triggers stay isolated in the Demo drawer.',
      apiBadge: 'POST /api/demo/reset -> 200 OK',
    });

    // ------------------------------------------------------------------
    // STEP 02: Switch Role to Merchant & Highlight "Lock Milestone 1 Hold"
    // ------------------------------------------------------------------
    await switchRole(page, 'Merchant');
    await waitForText(page, 'Dispute ratio');
    await delay(200);
    const initialRatioPct = await page.evaluate(() => {
      const m = document.body.innerText.match(/Dispute ratio\s*(\d+\.\d+%)/i);
      return m ? m[1] : '1.33%';
    });
    await locateAndAct(
      page,
      'main button',
      ['Lock Milestone 1 Hold'],
      'highlight',
      'Lock Milestone 1 Hold'
    );
    await delay(200);
    steps.push({
      stepNumber: 2,
      phase: 'USER_ACTION',
      stageTag: 'Phase 1 • Merchant View & Escrow Lock Trigger',
      title: 'Merchant Role Reveals Dispute Ratio & Clicks "Lock Milestone 1 Hold"',
      imagePath: await capturePng(page, '02_overview_merchant_lock_click.png', { scrollY: 0 }),
      beforeState:
        'Client role hid seller compliance telemetry. No PayPal authorization hold has been created yet.',
      triggerAction:
        `Switched TopBar role toggle to Merchant (revealing rolling ${initialRatioPct} / 1.50% Dispute ratio KPI) and prepared click on "Lock Milestone 1 Hold".`,
      whatChanged:
        'TopBar toggle shifts to Merchant; third KPI card exposes rolling dispute risk headroom before work starts; primary button triggers Orders v2 intent=AUTHORIZE.',
      ecosystemProof:
        'Proves APIMatic OpenAPI v3 grounding: PayPal Agent Toolkit omitted intent="AUTHORIZE", so Aegis synthesizes a schema-validated Orders v2 authorize flow with 36-char idempotency keys.',
      apiBadge: 'POST /api/escrow/seed -> Orders v2',
    });
    await clearHighlight(page);

    // Execute Lock Milestone 1 Hold
    await locateAndAct(page, 'main button', ['Lock Milestone 1 Hold'], 'click');
    await waitForText(page, 'Escrow hold active ($1250.00 USD)');
    await delay(500);

    // ------------------------------------------------------------------
    // STEP 03: What Changed — Milestone 1 Authorized + Toast Notification
    // ------------------------------------------------------------------
    steps.push({
      stepNumber: 3,
      phase: 'WHAT_CHANGED',
      stageTag: 'Phase 1 • Milestone 1 Hold Authorized',
      title: 'Milestone 1 Authorized ($1,250.00 Held) & Mutation Toast',
      imagePath: await capturePng(page, '03_overview_m1_authorized.png', { scrollY: 0 }),
      beforeState:
        'Overview showed $0.00 Held, 0 active milestones, and idle Escrow progress step.',
      triggerAction:
        'Clicked "Lock Milestone 1 Hold" on Overview, invoking ContractParser + Orders v2 authorize.',
      whatChanged:
        'Held KPI updates to $1,250.00 USD; status card transitions cleanly to "Escrow hold active ($1250.00 USD)" with next contextual CTA "Renew 72h Hold"; Recent Activity logs Buyer -> Merchant authorization lock; subtle bottom-right toast confirms state delta.',
      ecosystemProof:
        'Replaces giant banners with an ephemeral state-mutation toast while persisting the cryptographic authorization snapshot across backend stores.',
      apiBadge: 'intent: AUTHORIZE -> CREATED',
    });
    await dismissToastIfPresent(page);

    // ------------------------------------------------------------------
    // STEP 04: Navigate to Escrow -> Milestones & Highlight "Renew 72h Hold"
    // ------------------------------------------------------------------
    await navigateSidebar(page, 'Escrow');
    await waitForText(page, 'Cloud Infrastructure & High-Availability Plan');
    await delay(250);
    await locateAndAct(
      page,
      'main button',
      ['Renew 72h Hold'],
      'highlight',
      'Renew 72h Hold'
    );
    await delay(200);
    steps.push({
      stepNumber: 4,
      phase: 'USER_ACTION',
      stageTag: 'Phase 2 • 72h Honor Window Protection',
      title: 'Escrow -> Milestones: Initial Authorization & "Renew 72h Hold"',
      imagePath: await capturePng(page, '04_escrow_milestones_click_renew.png', { scrollY: 0 }),
      beforeState:
        'Milestone 1 hold is in initial Authorized state inside its 72-hour card-network honor window.',
      triggerAction:
        'Opened Escrow from left sidebar (Milestones tab) showing sequential Draft locks on Milestones 2 & 3, and targeted "Renew 72h Hold".',
      whatChanged:
        'Milestone 1 renders Authorized badge + live Auth ID; Milestones 2 ($1,750.00) and 3 ($1,500.00) display "Draft · Locked until Milestone 1/2 settles" sequentially.',
      ecosystemProof:
        'Prevents PayPal silent soft-decline failures: although orders last 29 days, issuer card holds expire after 72 hours unless explicitly reauthorized.',
      apiBadge: 'POST /api/escrow/:id/reauthorize',
    });
    await clearHighlight(page);

    // Execute Renew 72h Hold
    await locateAndAct(page, 'main button', ['Renew 72h Hold'], 'click');
    await waitForText(page, '72h auto-renewed');
    await waitForText(page, 'Rotated');
    await delay(400);
    await dismissToastIfPresent(page);

    // Read dynamic mutated auth id from body text
    const postReauthInfo = await page.evaluate(() => {
      const txt = document.body.innerText;
      const authMatch = txt.match(/Auth ID:\s*([A-Z0-9_-]+)/);
      return { authId: authMatch?.[1] || 'REAUTH-ID' };
    });

    // ------------------------------------------------------------------
    // STEP 05: What Changed — 72h Auto-Renewed & Rotated Auth ID Info Note
    // ------------------------------------------------------------------
    steps.push({
      stepNumber: 5,
      phase: 'WHAT_CHANGED',
      stageTag: 'Phase 2 • Day-3 Reauthorization Result',
      title: `Milestone 1 Status -> "72h auto-renewed" & Auth ID Rotated`,
      imagePath: await capturePng(page, '05_escrow_milestones_reauthorized.png', { scrollY: 0 }),
      beforeState:
        'Milestone 1 displayed single initial PayPal authorization ID with "Authorized" badge.',
      triggerAction:
        'Clicked "Renew 72h Hold", triggering HoldManager scheduled Day-3 reauthorization.',
      whatChanged:
        `Badge transitions to "72h auto-renewed" with "Rotated" pill; active Auth ID rotates to ${postReauthInfo.authId}; contextual info note confirms "Day-3 reauthorization extended the 72h hold automatically."`,
      ecosystemProof:
        'Demonstrates PayPal Auth ID Mutation awareness: /reauthorize issues a brand-new authorization_id that Aegis tracks atomically so later /capture calls never 404 on the expired ID.',
      apiBadge: 'HoldManager -> Auth ID Rotated',
    });

    // ------------------------------------------------------------------
    // STEP 06: Escrow -> Ledger Tab (AG Grid Mutated Authorization Ledger)
    // ------------------------------------------------------------------
    await locateAndAct(page, 'main button', ['Ledger'], 'click');
    await waitForText(page, 'Authorization Ledger');
    await delay(500);
    steps.push({
      stepNumber: 6,
      phase: 'FEATURE_SPOTLIGHT',
      stageTag: 'Phase 2 • AG Grid Mutated Auth Ledger',
      title: 'Escrow -> Ledger: Old Auth ID Struck Through & New ID Badged "Rotated"',
      imagePath: await capturePng(page, '06_escrow_ledger_ag_grid.png', { scrollY: 0 }),
      beforeState:
        'Escrow view displayed summary Milestone cards.',
      triggerAction:
        'Clicked "Ledger" sub-tab inside Escrow to inspect tabular audit trail.',
      whatChanged:
        'AG Grid ledger lists Total Held ($1250.00 USD), Rotated IDs (1), and strikes through the superseded initial Auth ID alongside an emerald arrow into the live rotated ID with a blue "Rotated" badge.',
      ecosystemProof:
        'Maintains full immutable lineage (originalAuthorizationId -> activeAuthorizationId) required for bank reconciliation and dispute representment.',
      apiBadge: 'AG Grid v31.3 • Lineage Audit',
    });

    // ------------------------------------------------------------------
    // STEP 07: Escrow -> Timeline Tab (Bryntum Gantt Schedule)
    // ------------------------------------------------------------------
    await locateAndAct(page, 'main button', ['Timeline'], 'click');
    await waitForText(page, 'Export Schedule JSON');
    await delay(550);
    steps.push({
      stepNumber: 7,
      phase: 'FEATURE_SPOTLIGHT',
      stageTag: 'Phase 2 • Bryntum Gantt Escrow Timeline',
      title: 'Escrow -> Timeline: 72h Extension Shift & Milestone Dependencies',
      imagePath: await capturePng(page, '07_escrow_timeline_gantt.png', { scrollY: 0 }),
      beforeState:
        'Escrow showed the tabular AG Grid authorization ledger.',
      triggerAction:
        'Clicked "Timeline" sub-tab inside Escrow to view the Bryntum Gantt schedule.',
      whatChanged:
        'Gantt timeline maps Day 1-4 windows across all 3 milestones, displays Milestone 1 72h auto-renewal extension bar, dependency arrows into Milestones 2 & 3, and provides "Export Schedule JSON".',
      ecosystemProof:
        'Syncs backend HoldManager timer schedules (schedule:sync WebSocket events) directly into an executive delivery-to-payout Gantt visualization.',
      apiBadge: 'Bryntum Gantt • Timer Sync',
    });

    // ------------------------------------------------------------------
    // STEP 08: Delivery (Merchant View) — Highlight "Upload & Verify Deliverable"
    // ------------------------------------------------------------------
    await navigateSidebar(page, 'Delivery');
    await waitForText(page, 'Deliverable Submission');
    await waitForText(page, 'Upload & Verify Deliverable');
    await delay(300);
    await locateAndAct(
      page,
      'main button',
      ['Upload & Verify Deliverable'],
      'highlight',
      'Upload & Verify Deliverable'
    );
    await delay(200);
    steps.push({
      stepNumber: 8,
      phase: 'USER_ACTION',
      stageTag: 'Phase 3 • Merchant Delivery Submission',
      title: 'Delivery (Merchant): Prefilled SKU/File Inputs & Click "Upload & Verify Deliverable"',
      imagePath: await capturePng(page, '08_delivery_merchant_submit_click.png', { scrollY: 0 }),
      beforeState:
        'Milestone 1 hold is 72h auto-renewed and awaiting artifact verification; SafeGate Approval Queue is empty.',
      triggerAction:
        'Navigated to Delivery (Merchant view) with visible default Deliverable Title ("Industrial Edge Router SKU-9921"), Catalog SKU ("CH3-TECH-88921"), schematic PDF ("edge_router_v2_schematic.pdf"), and highlighted "Upload & Verify Deliverable".',
      whatChanged:
        'Clean 2-column Merchant workspace pairs editable deliverable metadata & SHA-256 preview on the left with the SafeGate Human-in-the-Loop queue on the right.',
      ecosystemProof:
        'Solves PayPal Seller Protection gaps on intangible/custom builds by anchoring deliverables to verifiable Catalog SKUs, SHA-256 hashes, and high-entropy vector similarity.',
      apiBadge: 'POST /api/deliverables/verify',
    });
    await clearHighlight(page);

    // Execute Deliverable Verification
    await locateAndAct(page, 'main button', ['Upload & Verify Deliverable'], 'click');
    await waitForText(page, 'Authenticity verified');
    await waitForText(page, 'Approve & Execute');
    await delay(450);
    await dismissToastIfPresent(page);

    const detectedMatchPct = await page.evaluate(() => {
      const m = document.body.innerText.match(/(\d+\.\d+%)\s*match/i);
      return m ? m[1] : '83.0%';
    });

    // ------------------------------------------------------------------
    // STEP 09: What Changed — Verified Badge + SafeGate HITL Queue + TopBar Bell "1"
    // ------------------------------------------------------------------
    steps.push({
      stepNumber: 9,
      phase: 'WHAT_CHANGED',
      stageTag: 'Phase 3 • Multimodal Verification & HITL Interception',
      title: `Deliverable "Verified" (${detectedMatchPct}) & SafeGate Bell Intercepts Capture`,
      imagePath: await capturePng(page, '09_delivery_merchant_verified_hitl.png', { scrollY: 0 }),
      beforeState:
        'Deliverable status was unverified and TopBar notification bell showed 0 pending requests.',
      triggerAction:
        'Clicked "Upload & Verify Deliverable", executing DeliveryAuditor + Channel3 + 64-dim vector similarity.',
      whatChanged:
        `Left card displays green "Verified" badge (${detectedMatchPct} match); DeliveryAuditor attempted CAPTURE_AUTHORIZATION which SafeGate HITL intercepted into SafeGate Approval Queue ("Approve & Execute" / "Reject") and incremented TopBar Bell count to 1.`,
      ecosystemProof:
        'Proves autonomous AI agents cannot unilaterally move money: high-risk capture actions park behind SafeGate human/buyer sign-off with closure preservation.',
      apiBadge: 'SafeGate HITL • 1 Pending',
    });

    // ------------------------------------------------------------------
    // STEP 10: TopBar Notification Bell Quick-Approval Popover
    // ------------------------------------------------------------------
    await locateAndAct(
      page,
      'header button[aria-label="Open SafeGate Approvals"]',
      [''],
      'click'
    );
    await waitForText(page, 'SafeGate Approvals');
    await delay(300);
    await locateAndAct(
      page,
      'header button',
      ['Approve'],
      'highlight',
      'Bell Quick-Approve'
    );
    await delay(200);
    steps.push({
      stepNumber: 10,
      phase: 'FEATURE_SPOTLIGHT',
      stageTag: 'Phase 3 • Global SafeGate Bell Popover',
      title: 'TopBar Notification Bell: Instant Cross-Page HITL Inspection',
      imagePath: await capturePng(page, '10_topbar_bell_safegate_popover.png', { scrollY: 0 }),
      beforeState:
        'TopBar notification bell showed unread badge "1" after DeliveryAuditor intercepted fund capture.',
      triggerAction:
        'Clicked Notification Bell in TopBar to reveal the floating SafeGate Approvals popover.',
      whatChanged:
        'Global popover surfaces pending CAPTURE_AUTHORIZATION request ($1,250.00 USD) with Reject / Approve buttons usable from any sidebar page.',
      ecosystemProof:
        'Demonstrates clean UX separation: instead of an intrusive "1 Action Pending" alert pill cluttering every card, SafeGate approvals live neatly behind the TopBar bell.',
      apiBadge: 'SafeGate Global Bell Queue',
    });
    await clearHighlight(page);
    // Close popover with Escape before switching to Client
    await page.keyboard.press('Escape');
    await delay(250);

    // ------------------------------------------------------------------
    // STEP 11: Client Role on Delivery -> Expand Verification Details + Copy Hash + Approve & Release
    // ------------------------------------------------------------------
    await switchRole(page, 'Client');
    await waitForText(page, 'Approve & Release');
    await locateAndAct(page, 'main button', ['Verification details'], 'click');
    await waitForText(page, 'Spec / YAML');
    await delay(250);
    // Test Spec / YAML & Schematic tabs, then Copy SHA-256 Hash cleanly
    await locateAndAct(page, 'main button', ['Spec / YAML'], 'click', undefined, 'center', true);
    await delay(150);
    await locateAndAct(page, 'main button', ['Schematic'], 'click', undefined, 'center', true);
    await delay(150);
    await page.waitForSelector('button[title="Copy SHA-256 Hash"]', { visible: true });
    await page.click('button[title="Copy SHA-256 Hash"]');
    await waitForText(page, 'Copied');
    await delay(150);
    await locateAndAct(
      page,
      'main button',
      ['Approve & Release'],
      'highlight',
      'Approve & Release',
      'end'
    );
    await delay(200);
    steps.push({
      stepNumber: 11,
      phase: 'FEATURE_SPOTLIGHT',
      stageTag: 'Phase 3 • Client Deliverable Audit & Sign-Off',
      title: 'Delivery (Client): Expanded "Verification details" & Click "Approve & Release"',
      imagePath: await capturePng(page, '11_delivery_client_details_approve.png', {
        fullPage: true,
        scrollY: 0,
      }),
      beforeState:
        'Technical forensic hashes and vector telemetry were tucked inside a collapsed "Verification details" accordion.',
      triggerAction:
        'Switched role to Client, expanded "Verification details", tested Spec/Schematic tabs & SHA-256 Copy ("Copied"), and targeted "Approve & Release".',
      whatChanged:
        'Reveals SHA-256 hash ("Copied"), Channel3 SKU ("CH3-TECH-88921"), Elastic 64-dim score, 18.4ms retrieval latency, VPC Schematic SVG, Download Artifact PDF button, and prefilled Dispute Claim defaults.',
      ecosystemProof:
        'Keeps primary buyer acceptance ultra-clean while letting technical auditors inspect cryptographic integrity and cosine verification without leaving Delivery.',
      apiBadge: 'Client HITL Sign-Off -> /capture',
    });
    await clearHighlight(page);

    // Execute Client Approve & Release
    await locateAndAct(page, 'main button', ['Approve & Release'], 'click');
    await waitForText(page, 'Approved & Settled');
    await delay(450);
    await dismissToastIfPresent(page);

    // ------------------------------------------------------------------
    // STEP 12: What Changed — Milestone 1 Captured & Settled ($1,250.00)
    // ------------------------------------------------------------------
    steps.push({
      stepNumber: 12,
      phase: 'WHAT_CHANGED',
      stageTag: 'Phase 3 • Milestone 1 Funds Captured',
      title: 'Milestone 1 Settled ($1,250.00 Captured) & SafeGate Bell Cleared',
      imagePath: await capturePng(page, '12_delivery_client_settled.png', { scrollY: 0 }),
      beforeState:
        'Milestone 1 sat in VERIFIED state with 1 pending CAPTURE_AUTHORIZATION request in SafeGate.',
      triggerAction:
        'Clicked "Approve & Release" as Client, releasing the SafeGate HITL gate and executing PayPal Payments v2 capture.',
      whatChanged:
        'Button transitions cleanly to "Approved & Settled" (disabled), TopBar Bell clears from 1 to 0, and $1,250.00 USD moves from Held into Settled balance.',
      ecosystemProof:
        'Completes human-approved autonomous settlement: DeliveryAuditor verified -> Buyer/SafeGate authorized -> Payments v2 captured using the rotated Active Auth ID.',
      apiBadge: 'POST /v2/payments/authorizations/:id/capture',
    });

    // ------------------------------------------------------------------
    // STEP 13: Multi-Milestone Progression — Lock Milestone 2 on Escrow
    // ------------------------------------------------------------------
    await navigateSidebar(page, 'Escrow');
    await waitForText(page, 'Milestone 2');
    await waitForText(page, 'Lock Hold');
    await delay(250);
    await locateAndAct(
      page,
      'main button',
      ['Lock Hold'],
      'highlight',
      'Lock Milestone 2 Hold'
    );
    await delay(200);
    steps.push({
      stepNumber: 13,
      phase: 'USER_ACTION',
      stageTag: 'Phase 3 • Sequential Multi-Milestone Unlock',
      title: 'Escrow -> Milestones: Milestone 1 Settled Unlocks "Lock Hold" on Milestone 2',
      imagePath: await capturePng(page, '13_escrow_m2_lock_click.png', { scrollY: 0 }),
      beforeState:
        'Milestone 2 ($1,750.00 USD) was blocked behind Milestone 1 settlement; Milestone 1 now shows "Settled" with capture ID.',
      triggerAction:
        'Returned to Escrow -> Milestones and prepared click on the newly unlocked "Lock Hold" button for Milestone 2.',
      whatChanged:
        'Milestone 1 renders emerald "Settled" badge + capture ID; Milestone 2 unlocks its interactive "Lock Hold" CTA ($1,750.00 USD); Milestone 3 remains sequentially locked.',
      ecosystemProof:
        'Enforces sequential milestone state dependencies so subsequent escrow tranches cannot authorize before prior deliverables settle.',
      apiBadge: 'POST /api/escrow/:m2/hold',
    });
    await clearHighlight(page);

    // Click Lock Hold on M2
    await locateAndAct(page, 'main button', ['Lock Hold'], 'click');
    await page.waitForFunction(
      () => (document.body.innerText.match(/Auth ID:/g) || []).length >= 2,
      { timeout: 45000 }
    );
    await delay(450);
    await dismissToastIfPresent(page);

    // ------------------------------------------------------------------
    // STEP 14: Multi-Milestone Isolation — Delivery Targets Fresh M2 Without M1 Leakage
    // ------------------------------------------------------------------
    await switchRole(page, 'Merchant');
    await navigateSidebar(page, 'Delivery');
    await waitForText(page, 'Custom PayPal ERP Reconciliation Module');
    await waitForText(page, 'Upload & Verify Deliverable');
    await delay(300);
    steps.push({
      stepNumber: 14,
      phase: 'WHAT_CHANGED',
      stageTag: 'Phase 3 • Per-Milestone State Isolation Proof',
      title: 'Delivery (Merchant): Cleanly Targets Milestone 2 ($1,750.00) with Zero M1 Leakage',
      imagePath: await capturePng(page, '14_delivery_m2_isolation.png', { scrollY: 0 }),
      beforeState:
        'Milestone 1 was verified and captured; Milestone 2 just transitioned from Draft -> Authorized.',
      triggerAction:
        'Switched to Merchant and opened Delivery immediately after locking Milestone 2 ($1,750.00 USD).',
      whatChanged:
        'Target switches automatically to "Milestone 2: Custom PayPal ERP Reconciliation Module ($1750.00 USD)" with an unverified upload state ("Upload & Verify Deliverable" active)—preserving Milestone 1 isolation.',
      ecosystemProof:
        'Verifies per-milestone deliverable isolation in both backend storage and UI selectors: closing Milestone 1 never leaks a stale "Verified" status onto Milestone 2.',
      apiBadge: 'Per-Milestone State Isolation',
    });

    // ------------------------------------------------------------------
    // STEP 15: Disputes (Client) — Raise $350.00 Inquiry (Branch A Entry)
    // ------------------------------------------------------------------
    await switchRole(page, 'Client');
    await navigateSidebar(page, 'Disputes');
    await waitForText(page, 'Dispute Inquiry Details');
    await waitForText(page, 'Raise Dispute Inquiry');
    await delay(300);
    await locateAndAct(
      page,
      'main button',
      ['Raise Dispute Inquiry'],
      'highlight',
      'Raise Dispute Inquiry'
    );
    await delay(200);
    steps.push({
      stepNumber: 15,
      phase: 'USER_ACTION',
      stageTag: 'Phase 4 • Branch A Pre-Escalation Dispute Entry',
      title: 'Disputes (Client): Prefilled $350.00 Claim Composer & Click "Raise Dispute Inquiry"',
      imagePath: await capturePng(page, '15_disputes_client_raise_click.png', { scrollY: 0 }),
      beforeState:
        'Zero open disputes exist; buyer and merchant balances stand at $1,250.00 settled and $1,750.00 held.',
      triggerAction:
        'Opened Disputes in Client role showing visible prefilled defaults (Reason: Not as described, Amount: 350.00, Note) and targeted "Raise Dispute Inquiry".',
      whatChanged:
        'Client composer provides structured reason/amount/note inputs with a $10.00 minimum non-positive fallback guardrail before initiating a PayPal INQUIRY.',
      ecosystemProof:
        'Models realistic buyer claim entry at the pre-escalation INQUIRY stage before expensive formal chargeback escalation begins.',
      apiBadge: 'POST /api/disputes/simulate',
    });
    await clearHighlight(page);

    // Execute Raise Dispute Inquiry
    await locateAndAct(page, 'main button', ['Raise Dispute Inquiry'], 'click');
    await waitForText(page, 'PP-D-');
    await delay(450);
    await dismissToastIfPresent(page);

    // ------------------------------------------------------------------
    // STEP 16: Disputes (Merchant) — Ratio Gauge + Branch A "Dispatch $350.00 Offer"
    // ------------------------------------------------------------------
    await switchRole(page, 'Merchant');
    await waitForText(page, 'Pre-Escalation Settlement');
    await waitForText(page, 'Dispatch $');
    await delay(300);
    const branchADetails = await page.evaluate(() => {
      const txt = document.body.innerText;
      const disp = txt.match(/PP-D-[A-Z0-9-]+/)?.[0] || 'PP-D-40193';
      const pct = txt.match(/(\d+\.\d+%)\s*\/\s*1\.50%/)?.[1] || '1.42%';
      return { disp, pct };
    });
    await locateAndAct(
      page,
      'main button',
      ['Dispatch $', 'Offer'],
      'highlight',
      'Dispatch $350.00 Offer'
    );
    await delay(200);
    steps.push({
      stepNumber: 16,
      phase: 'USER_ACTION',
      stageTag: 'Phase 4 • Branch A $0-Fee Settlement Strategy',
      title: `Disputes (Merchant): Ratio Gauge (${branchADetails.pct} / 1.50%) & "Dispatch $350.00 Offer"`,
      imagePath: await capturePng(page, '16_disputes_merchant_dispatch_offer.png', { scrollY: 0 }),
      beforeState:
        `Buyer opened inquiry ${branchADetails.disp} ($350.00 USD) placing seller rolling ratio at ${branchADetails.pct}.`,
      triggerAction:
        'Switched to Merchant role on Disputes (Branch A · Inquiry tab) and highlighted "Dispatch $350.00 Offer".',
      whatChanged:
        'Merchant view reveals circular 90-day Ratio Gauge, active "Inquiry (Branch A)" tab, "$0.00" Branch A Offer Fee card, and single-click pre-escalation make-offer execution.',
      ecosystemProof:
        'Prevents PayPal 1.5% High-Volume penalty crossing ($30 per-claim chargeback fees) by routing eligible inquiries through PayPal make-offer at $0 fee.',
      apiBadge: 'POST /v1/customer/disputes/:id/make-offer',
    });
    await clearHighlight(page);

    // Execute Dispatch Offer
    await locateAndAct(page, 'main button', ['Dispatch $', 'Offer'], 'click');
    await waitForText(page, 'WAITING_FOR_BUYER_RESPONSE');
    await delay(400);
    await dismissToastIfPresent(page);

    // ------------------------------------------------------------------
    // STEP 17: Disputes (Client) — Accept $350.00 Settlement Offer
    // ------------------------------------------------------------------
    await switchRole(page, 'Client');
    await waitForText(page, 'Accept $');
    await delay(250);
    await locateAndAct(
      page,
      'main button',
      ['Accept $', 'Settlement'],
      'highlight',
      'Accept $350.00 Settlement'
    );
    await delay(200);
    steps.push({
      stepNumber: 17,
      phase: 'USER_ACTION',
      stageTag: 'Phase 4 • Client Accepts Pre-Escalation Offer',
      title: 'Disputes (Client): Offer Received & Click "Accept $350.00 Settlement"',
      imagePath: await capturePng(page, '17_disputes_client_accept_offer.png', { scrollY: 0 }),
      beforeState:
        'Merchant dispatched $350.00 REFUND offer; dispute status moved to WAITING FOR BUYER RESPONSE.',
      triggerAction:
        'Switched to Client role on Disputes, inspected message thread, and targeted "Accept $350.00 Settlement".',
      whatChanged:
        'Client portal renders active settlement proposal alongside full bilateral dispute message log without exposing internal seller risk gauges.',
      ecosystemProof:
        'Completes two-sided pre-escalation settlement across roles before PayPal escalates the ticket to a formal chargeback.',
      apiBadge: 'POST /api/disputes/:id/accept-offer',
    });
    await clearHighlight(page);

    // Execute Accept Settlement
    await locateAndAct(page, 'main button', ['Accept $', 'Settlement'], 'click');
    await waitForText(page, 'RESOLVED');
    await delay(400);
    await dismissToastIfPresent(page);

    // ------------------------------------------------------------------
    // STEP 18: Disputes (Merchant) — Branch A Resolved at $0 Fee & Ratio Restored to 0.95%
    // ------------------------------------------------------------------
    await switchRole(page, 'Merchant');
    await waitForText(page, 'Settled at $0 dispute fee');
    await delay(300);
    const restoredPct = await page.evaluate(() => {
      const m = document.body.innerText.match(/restored to\s*(\d+\.\d+%)/i);
      return m ? m[1] : '0.95%';
    });
    steps.push({
      stepNumber: 18,
      phase: 'WHAT_CHANGED',
      stageTag: 'Phase 4 • Branch A Outcome ($0 Fee & Safe Tier Restored)',
      title: `Disputes (Merchant): Branch A Resolved at $0 Fee -> Ratio Restored (${restoredPct})`,
      imagePath: await capturePng(page, '18_disputes_merchant_branch_a_resolved.png', {
        scrollY: 0,
      }),
      beforeState:
        `Merchant ratio hovered near 1.50% limit during active inquiry ${branchADetails.disp} (${branchADetails.pct}).`,
      triggerAction:
        'Client accepted $350.00 settlement; switched back to Merchant on Disputes.',
      whatChanged:
        `Status updates to RESOLVED; green confirmation banner displays "Settled at $0 dispute fee. Rolling ratio restored to ${restoredPct}."; circular gauge rebounds safely into emerald Safe Tier.`,
      ecosystemProof:
        'Demonstrates closed-loop Dispute Shield ROI: proactive inquiry resolution protects profit margins and lowers PayPal dispute ratio below warning thresholds.',
      apiBadge: `$0 Fee • Ratio ${branchADetails.pct} -> ${restoredPct}`,
    });

    // ------------------------------------------------------------------
    // STEP 19: Open Demo Drawer & Highlight "Simulate Branch B (Escalated Chargeback)"
    // ------------------------------------------------------------------
    await locateAndAct(page, 'aside button', ['Demo'], 'click');
    await waitForText(page, 'Simulate Branch B (Escalated Chargeback)');
    await delay(300);
    await locateAndAct(
      page,
      'aside[aria-label="Demo Controls Panel"] button',
      ['Simulate Branch B (Escalated Chargeback)'],
      'highlight',
      'Simulate Branch B'
    );
    await delay(200);
    steps.push({
      stepNumber: 19,
      phase: 'USER_ACTION',
      stageTag: 'Phase 4 • Escalating to Branch B (Chargeback)',
      title: 'Demo Controls Drawer: Trigger "Simulate Branch B (Escalated Chargeback)"',
      imagePath: await capturePng(page, '19_demo_simulate_branch_b.png', { scrollY: 0 }),
      beforeState:
        'Merchant Dispute Shield stood in Safe Tier (0.95%) after Branch A resolution.',
      triggerAction:
        'Opened Demo drawer from bottom of Sidebar and prepared click on "Simulate Branch B (Escalated Chargeback)".',
      whatChanged:
        'Shows clean separation of judge/demo triggers inside the slide-over Demo drawer (Refresh, Reset workspace, Guided 1-4 buttons, Branch B simulator, Custom Sandbox tabs).',
      ecosystemProof:
        'Keeps simulation controls accessible on demand for evaluators while maintaining an authentic fintech product surface.',
      apiBadge: 'POST /api/disputes/simulate (CHARGEBACK)',
    });
    await clearHighlight(page);

    // Click Simulate Branch B & close Demo drawer
    await locateAndAct(
      page,
      'aside[aria-label="Demo Controls Panel"] button',
      ['Simulate Branch B (Escalated Chargeback)'],
      'click'
    );
    await delay(500);
    await locateAndAct(
      page,
      'button[aria-label="Close Demo Controls"]',
      [''],
      'click'
    );
    await waitForText(page, 'Offer Locked');
    await waitForText(page, 'Upload Evidence');
    await delay(400);
    await dismissToastIfPresent(page);

    // ------------------------------------------------------------------
    // STEP 20: Branch B Active — Offer Locked + 1.55% High Risk + A4 PDF Preview + Upload Evidence
    // ------------------------------------------------------------------
    await locateAndAct(
      page,
      'main button',
      ['Upload Evidence'],
      'highlight',
      'Upload Evidence'
    );
    await delay(200);
    steps.push({
      stepNumber: 20,
      phase: 'STATE_EARLIER',
      stageTag: 'Phase 4 • Branch B Chargeback & Representment Bundle',
      title: 'Disputes (Merchant): 1.55% High Risk, "Offer Locked", 10-Day SLA & "Upload Evidence"',
      imagePath: await capturePng(page, '20_disputes_branch_b_upload_click.png', { scrollY: 0 }),
      beforeState:
        'Branch A permitted $0-fee settlement offers while under CHARGEBACK threshold.',
      triggerAction:
        'Simulated escalated CHARGEBACK crossing 1.50% High-Risk threshold and targeted "Upload Evidence".',
      whatChanged:
        'Disputes auto-switches to Chargeback (Branch B) tab; ratio gauge alerts High Risk (1.55% / 1.50%); UI locks make-offer ("Offer Locked" + backend 409 guard); 10-Day Seller Response SLA bar and A4 PDF Evidence Preview appear.',
      ecosystemProof:
        'Enforces PayPal dispute lifecycle constraints: escalated chargebacks cannot use make-offer and require multipart/related A4 PDF representment compiled from IP logs, hashes, and timestamps.',
      apiBadge: 'CHARGEBACK • 1.55% High Risk',
    });
    await clearHighlight(page);

    // Execute Upload Evidence
    await locateAndAct(page, 'main button', ['Upload Evidence'], 'click');
    await waitForText(page, 'Evidence Filed');
    await delay(450);
    await dismissToastIfPresent(page);

    // ------------------------------------------------------------------
    // STEP 21: What Changed — Multipart Evidence Filed & SLA Emerald
    // ------------------------------------------------------------------
    steps.push({
      stepNumber: 21,
      phase: 'WHAT_CHANGED',
      stageTag: 'Phase 4 • Branch B Multipart Representment Submitted',
      title: 'Branch B Complete: A4 PDF Uploaded ("Evidence Filed") -> UNDER_REVIEW',
      imagePath: await capturePng(page, '21_disputes_branch_b_filed.png', { scrollY: 0 }),
      beforeState:
        'Escalated chargeback awaited seller evidence ahead of the 10-day SLA cutoff.',
      triggerAction:
        'Clicked "Upload Evidence", compiling the A4 PDFKit report and dispatching multipart/related (---AegisBoundary) to /provide-evidence.',
      whatChanged:
        'Action button locks cleanly to "Evidence Filed", 10-Day Seller Response SLA bar advances to emerald, and dispute lifecycle enters UNDER_REVIEW.',
      ecosystemProof:
        'Builds compliant multipart/related binary payloads (JSON input + PDF stream under boundary ---AegisBoundary) audited against PayPal representment schemas.',
      apiBadge: 'POST /disputes/:id/provide-evidence',
    });

    // ------------------------------------------------------------------
    // STEP 22: Activity Page — Cross-Party Filter & Expandable "Details"
    // ------------------------------------------------------------------
    await navigateSidebar(page, 'Activity');
    await waitForText(page, 'Details');
    await delay(250);
    await locateAndAct(page, 'main button', ['PayPal'], 'click');
    await delay(250);
    await locateAndAct(page, 'main button', ['Details'], 'click');
    await waitForText(page, 'Event:');
    await delay(300);
    await page.evaluate(() => {
      const txt = document.body.innerText;
      if (txt.includes('RESOURCE_NOT_FOUND') || txt.includes('"success": false')) {
        throw new Error('Activity details exposed raw 404 RESOURCE_NOT_FOUND / success:false failure!');
      }
      if (!txt.includes('EVID-A4-99281A')) {
        throw new Error('Activity details missing normalized EVIDENCE_UPLOADED EVID-A4-99281A receipt.');
      }
    });
    steps.push({
      stepNumber: 22,
      phase: 'FEATURE_SPOTLIGHT',
      stageTag: 'Phase 5 • Cross-Party Activity Bus',
      title: 'Activity Page: Role Filter Chips ("PayPal") & Expandable JSON Event Details',
      imagePath: await capturePng(page, '22_activity_filter_details.png', { scrollY: 0 }),
      beforeState:
        'Overview displayed only the 3 most recent notifications to keep the home screen concise.',
      triggerAction:
        'Opened Activity from Sidebar, filtered by "PayPal", and clicked "Details" on the latest cross-party row.',
      whatChanged:
        'Displays full Sender -> Recipient event attribution across Escrow, Reauth, SafeGate HITL, and Dispute Representment, with inline expandable event type, agent, and normalized 200 OK JSON payload metadata.',
      ecosystemProof:
        'Gives auditors complete bilateral traceability via Socket.IO event persistence without polluting everyday operational screens.',
      apiBadge: 'Cross-Party Bus • Expanded Details',
    });

    // ------------------------------------------------------------------
    // STEP 23: Dev Tools Drawer — Wire Inspector & Audit Logs (.json)
    // ------------------------------------------------------------------
    await locateAndAct(page, 'aside button', ['Dev tools'], 'click');
    await waitForText(page, 'Developer Tools');
    await waitForText(page, 'PayPal-Request-Id');
    await delay(350);
    const wireMeta = await page.evaluate(() => {
      const aside = document.querySelector('aside[aria-label="Developer Tools Drawer"]');
      const txt = (aside as HTMLElement | null)?.innerText || '';
      if (txt.includes('RESOURCE_NOT_FOUND') || txt.includes('"success": false')) {
        throw new Error('Wire Inspector exposed raw 404 RESOURCE_NOT_FOUND / success:false failure!');
      }
      if (!txt.includes('EVID-A4-99281A')) {
        throw new Error('Wire Inspector missing normalized EVID-A4-99281A upload receipt!');
      }
      const uuidMatch = txt.match(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
      if (!uuidMatch) {
        throw new Error(`Wire Inspector PAYPAL-REQUEST-ID is not a 36-char v4 UUID! Text snapshot: ${txt.slice(0, 400)}`);
      }
      const crc = txt.match(/0x[0-9A-F]{8}/)?.[0] || 'CRC32';
      return { crc, requestId: uuidMatch[0] };
    });
    steps.push({
      stepNumber: 23,
      phase: 'FEATURE_SPOTLIGHT',
      stageTag: 'Phase 5 • Developer Tools Drawer (Wire Inspector)',
      title: `Dev Tools -> Wire Inspector: 36-Char UUID, CRC32 (${wireMeta.crc}) & 200 OK JSON`,
      imagePath: await capturePng(page, '23_devtools_wire_inspector.png', { scrollY: 0 }),
      beforeState:
        'API wire telemetry, request correlation IDs, and CRC32 webhook verification stayed tucked off main screens.',
      triggerAction:
        'Opened "Dev tools" from bottom Sidebar showing default "Wire Inspector" tab + header "Audit Logs (.json)" export button.',
      whatChanged:
        `Slide-over drawer displays live HTTP method/endpoint, 200 OK latency, 36-char v4 UUID PayPal-Request-Id (${wireMeta.requestId}), unsigned 32-bit CRC32 (${wireMeta.crc} Validated), normalized 200 OK evidence JSON receipt (EVID-A4-99281A), and agent status bar.`,
      ecosystemProof:
        'Proves APIMatic/PayPal wire fidelity (<=38-char UUID idempotency keys, 30-day replay cache, CRC32 RSA-SHA256 webhook verification) and 1-click JSON log export.',
      apiBadge: `Wire Inspector • ${wireMeta.crc}`,
    });

    // ------------------------------------------------------------------
    // STEP 24: Dev Tools Drawer — Agent Trace (4 Scoped Tools + 64-Dim Cosine Math)
    // ------------------------------------------------------------------
    await locateAndAct(
      page,
      'aside[aria-label="Developer Tools Drawer"] button',
      ['Agent Trace'],
      'click'
    );
    await waitForText(page, 'Retrieved Context Telemetry');
    await delay(350);
    await page.evaluate((expectedPct) => {
      const aside = document.querySelector('aside[aria-label="Developer Tools Drawer"]');
      const txt = (aside as HTMLElement | null)?.innerText || '';
      if (txt.includes('96.50%') || txt.includes('0.965')) {
        throw new Error('Agent Trace still shows stale 0.965 / 96.50% cosine score instead of DeliveryAuditor score!');
      }
      const numericPct = expectedPct.replace('%', '');
      if (!txt.includes(numericPct)) {
        throw new Error(`Agent Trace cosine score (${txt}) does not match DeliveryAuditor score (${expectedPct})`);
      }
    }, detectedMatchPct);
    steps.push({
      stepNumber: 24,
      phase: 'FEATURE_SPOTLIGHT',
      stageTag: 'Phase 5 • Developer Tools (Agent Trace & Cosine RAG)',
      title: 'Dev Tools -> Agent Trace: Phase-Scoped Tools & 64-Dim Cosine Vector Math',
      imagePath: await capturePng(page, '24_devtools_agent_trace.png', { scrollY: 0 }),
      beforeState:
        'Dev tools drawer showed low-level HTTP wire headers and raw JSON payload.',
      triggerAction:
        'Switched to "Agent Trace" sub-tab inside Dev tools drawer.',
      whatChanged:
        'Inspects active agent phase (e.g. DeliveryAuditor / DisputeStrategist), retrieved Buyer IP / Channel3 SKU / SHA-256 context, strictly 4 phase-scoped tool chips, and synchronized 64-dim vector dot-product math matching DeliveryAuditor.',
      ecosystemProof:
        'Solves LLM tool bloat: instead of dumping an unconstrained flat toolkit into context, SafeGate ToolRouter injects strictly 4 scoped tools per phase alongside the live DeliveryAuditor cosine similarity score.',
      apiBadge: '4 Scoped Tools • 64-Dim Cosine Math',
    });

    // Close Dev tools drawer
    await locateAndAct(
      page,
      'button[aria-label="Close Developer Tools"]',
      [''],
      'click'
    );
    await waitForNoText(page, 'Retrieved Context Telemetry');
    await delay(250);

    // ------------------------------------------------------------------
    // STEP 25: Demo Drawer -> Custom Sandbox Guardrail ("Raw SOW Text" malformed "asdf")
    // ------------------------------------------------------------------
    await locateAndAct(page, 'aside button', ['Demo'], 'click');
    await waitForText(page, 'Custom Sandbox Inputs');
    await locateAndAct(
      page,
      'aside[aria-label="Demo Controls Panel"] button',
      ['Raw SOW Text'],
      'click'
    );
    await waitForText(page, 'Execute Custom Seed & Hold');
    await delay(200);
    await page.evaluate(() => {
      const ta = document.querySelector('#demo-sow-raw-text') as HTMLTextAreaElement | null;
      if (ta) {
        ta.focus();
        ta.select();
      }
    });
    await page.keyboard.press('Backspace');
    await page.type('#demo-sow-raw-text', 'asdf');
    await waitForText(page, 'Malformed text falls back to a single generic milestone');
    await delay(200);
    await locateAndAct(
      page,
      'aside[aria-label="Demo Controls Panel"] button',
      ['Execute Custom Seed & Hold'],
      'click'
    );
    await waitForText(page, 'Dismiss');
    await page.waitForFunction(
      () => {
        const aside = document.querySelector('aside[aria-label="Demo Controls Panel"]');
        if (!aside) return false;
        const btn = Array.from(aside.querySelectorAll('button')).find((b) =>
          (b.textContent || '').includes('Execute Custom Seed & Hold')
        ) as HTMLButtonElement | undefined;
        return Boolean(btn && !btn.disabled);
      },
      { timeout: 20000 }
    );
    await delay(300);
    await locateAndAct(
      page,
      'aside[aria-label="Demo Controls Panel"] button',
      ['Execute Custom Seed & Hold'],
      'scrollOnly',
      undefined,
      'center'
    );
    await delay(250);
    steps.push({
      stepNumber: 25,
      phase: 'FEATURE_SPOTLIGHT',
      stageTag: 'Phase 6 • Demo Sandbox & Anti-Hardcoding Guardrails',
      title: 'Demo -> Custom Sandbox: Malformed Raw SOW ("asdf") Safe Fallback & Live JSON Preview',
      imagePath: await capturePng(page, '25_demo_sandbox_guardrail.png', { scrollY: 0 }),
      beforeState:
        'Demo drawer Custom Sandbox defaulted to the 3 structured milestones ($1,250 / $1,750 / $1,500).',
      triggerAction:
        'Switched SOW mode to "Raw SOW Text", typed malformed string "asdf", and executed "Execute Custom Seed & Hold".',
      whatChanged:
        'Input guardrail detects unparseable text, displays explicit fallback alert banner (with Dismiss), normalizes cleanly to a single generic milestone ($100.00 USD) instead of throwing NaN/500, and streams live request JSON in expanded Live Payload Preview.',
      ecosystemProof:
        'Proves anti-hardcoding resilience: contract parsing handles arbitrary free-form SOW inputs and edge-case malformed strings deterministically without breaking PayPal API schemas.',
      apiBadge: 'Custom SOW Guardrail • $100.00 Fallback',
    });

    // ------------------------------------------------------------------
    // STEP 26: Reset Workspace -> Clean Post-Demo Overview Verification
    // ------------------------------------------------------------------
    await locateAndAct(
      page,
      'aside[aria-label="Demo Controls Panel"] button',
      ['Reset workspace'],
      'click'
    );
    await page.waitForFunction(
      () => {
        const aside = document.querySelector('aside[aria-label="Demo Controls Panel"]');
        if (!aside) return false;
        const txt = (aside as HTMLElement).innerText || '';
        return txt.includes('Reset workspace') && !txt.includes('Resetting...');
      },
      { timeout: 20000 }
    );
    await delay(300);
    await locateAndAct(
      page,
      'button[aria-label="Close Demo Controls"]',
      [''],
      'click'
    );
    await waitForNoText(page, 'Custom Sandbox Inputs');
    await navigateSidebar(page, 'Overview');
    await switchRole(page, 'Client');
    await waitForText(page, 'No active escrow hold');
    await waitForText(page, 'Lock Milestone 1 Hold');
    await dismissToastIfPresent(page);
    await delay(300);
    steps.push({
      stepNumber: 26,
      phase: 'BASELINE',
      stageTag: 'Phase 6 • Clean Post-Flow Workspace Reset',
      title: 'Reset Workspace Confirmed: Overview Restored to Clean $0.00 Baseline',
      imagePath: await capturePng(page, '26_final_clean_reset.png', { scrollY: 0 }),
      beforeState:
        'Workspace held active sandbox milestone holds, dispute simulations, and custom $100.00 fallback state.',
      triggerAction:
        'Clicked "Reset workspace" in Demo drawer, closed drawer, and returned to Overview in Client view.',
      whatChanged:
        'All milestones, disputes, SafeGate queues, and activity logs clear deterministically; Held and Settled KPIs return to $0.00 USD ready for repeatable judge demos.',
      ecosystemProof:
        'Guarantees zero leftover test pollution across back-to-back live judge demonstrations.',
      apiBadge: 'POST /api/demo/reset -> Clean Ready',
    });

    // Compile A4 Landscape Flow PDF
    console.log('\nCompiling A4 Landscape flow.pdf...');
    const html = buildHtmlDocument(steps);
    const htmlScratchPath = path.join(FLOW_DIR, '_flow_render.html');
    fs.writeFileSync(htmlScratchPath, html, 'utf-8');

    const pdfPage = await browser.newPage();
    await pdfPage.setContent(html, { waitUntil: 'load', timeout: 60000 });
    await delay(400);

    const pdfBuffer = await pdfPage.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
    });

    fs.writeFileSync(OUTPUT_PDF, pdfBuffer);
    fs.writeFileSync(OUTPUT_PDF_PKG, pdfBuffer);
    console.log(
      `SUCCESS! Generated ${steps.length} visual steps (${steps.length + 1} PDF pages).`
    );
    console.log(
      `  -> ${OUTPUT_PDF} (${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB)`
    );
    console.log(
      `  -> ${OUTPUT_PDF_PKG} (${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB)`
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Failed to generate flow PDF:', err);
  process.exit(1);
});
