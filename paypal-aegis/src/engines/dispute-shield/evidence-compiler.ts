/**
 * Dispute Shield — Automated PDF Evidence Compiler
 *
 * Uses PDFKit to generate A4 PDF documents containing dispute evidence.
 * Every page header includes: buyer name, email, PayPal Transaction ID, Invoice ID.
 *
 * Evidence includes:
 * - Delivery timestamps and tracking info
 * - IP logs
 * - SHA-256 content hashes
 * - SOW approvals
 *
 * Output is strictly kept under 10MB.
 */

import PDFDocument from 'pdfkit';
import * as crypto from 'crypto';
import logger from '../../lib/logger';
import { PayPalDispute, PayPalAmount } from '../../types';

// A4 dimensions in points (72 DPI): 595.28 x 841.89
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10MB

export interface EvidenceData {
  buyerName: string;
  buyerEmail: string;
  transactionId: string;
  invoiceId: string;
  disputeId: string;
  disputeAmount: PayPalAmount;
  disputeReason: string;
  deliveryTimestamps: DeliveryRecord[];
  ipLogs: IpLogEntry[];
  contentHashes: ContentHashRecord[];
  sowApprovals: SowApproval[];
  additionalNotes?: string;
}

export interface DeliveryRecord {
  description: string;
  deliveredAt: string;
  trackingNumber?: string;
  carrier?: string;
  recipientName?: string;
}

export interface IpLogEntry {
  timestamp: string;
  ipAddress: string;
  action: string;
  userAgent?: string;
}

export interface ContentHashRecord {
  filename: string;
  sha256: string;
  uploadedAt: string;
  sizeBytes: number;
}

export interface SowApproval {
  milestoneName: string;
  approvedAt: string;
  approvedBy: string;
  notes?: string;
}

/**
 * Renders the standardized page header on each page.
 */
function renderPageHeader(
  doc: PDFKit.PDFDocument,
  evidence: EvidenceData,
  pageNum: number
): void {
  const headerTop = MARGIN;

  // Aegis logo / title
  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('PayPal Aegis — Dispute Evidence Report', MARGIN, headerTop, {
      width: CONTENT_WIDTH,
      align: 'center',
    });

  doc.moveDown(0.5);

  // Case details header block
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#555555');

  const headerY = doc.y;
  const col1X = MARGIN;
  const col2X = MARGIN + CONTENT_WIDTH / 2;

  doc.text(`Buyer: ${evidence.buyerName}`, col1X, headerY);
  doc.text(`Email: ${evidence.buyerEmail}`, col2X, headerY);

  doc.text(`Transaction ID: ${evidence.transactionId}`, col1X, headerY + 14);
  doc.text(`Invoice ID: ${evidence.invoiceId}`, col2X, headerY + 14);

  doc.text(`Dispute ID: ${evidence.disputeId}`, col1X, headerY + 28);
  doc.text(`Page: ${pageNum}`, col2X, headerY + 28);

  // Horizontal rule
  doc
    .moveTo(MARGIN, headerY + 46)
    .lineTo(PAGE_WIDTH - MARGIN, headerY + 46)
    .strokeColor('#CCCCCC')
    .lineWidth(1)
    .stroke();

  doc.y = headerY + 56;
  doc.fillColor('#000000');
}

/**
 * Renders a section title.
 */
function renderSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  doc
    .fontSize(13)
    .font('Helvetica-Bold')
    .fillColor('#1a3c6e')
    .text(title, MARGIN, doc.y, { width: CONTENT_WIDTH })
    .moveDown(0.3)
    .fillColor('#000000');
}

/**
 * Renders a key-value pair line.
 */
function renderField(doc: PDFKit.PDFDocument, label: string, value: string): void {
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(`${label}: `, MARGIN, doc.y, { continued: true })
    .font('Helvetica')
    .text(value, { width: CONTENT_WIDTH - 100 });
}

/**
 * Checks if we need a new page (with safety margin).
 */
function ensureSpace(
  doc: PDFKit.PDFDocument,
  evidence: EvidenceData,
  pageRef: { count: number },
  requiredHeight: number = 100
): void {
  if (doc.y + requiredHeight > PAGE_HEIGHT - MARGIN - 30) {
    doc.addPage({ size: 'A4', margin: MARGIN });
    pageRef.count++;
    renderPageHeader(doc, evidence, pageRef.count);
  }
}

/**
 * Compiles dispute evidence into a PDF document.
 *
 * @param evidence - The evidence data to compile
 * @returns Buffer containing the generated PDF, strictly under 10MB
 */
export async function compileEvidencePdf(
  evidence: EvidenceData
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: MARGIN,
        info: {
          Title: `Dispute Evidence — ${evidence.disputeId}`,
          Author: 'PayPal Aegis',
          Subject: 'Dispute Evidence Report',
          Creator: 'PayPal Aegis Dispute Shield',
        },
      });

      const chunks: Buffer[] = [];
      let totalBytes = 0;

      doc.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_PDF_BYTES) {
          doc.end();
          reject(new Error(`PDF exceeded ${MAX_PDF_BYTES} byte limit at ${totalBytes} bytes`));
          return;
        }
        chunks.push(chunk);
      });

      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        logger.info('Evidence PDF compiled', {
          disputeId: evidence.disputeId,
          sizeBytes: pdfBuffer.length,
          sizeMB: (pdfBuffer.length / (1024 * 1024)).toFixed(2),
        });
        resolve(pdfBuffer);
      });

      doc.on('error', (err: Error) => {
        reject(err);
      });

      const pageRef = { count: 1 };

      // Page 1: Header + Case Summary
      renderPageHeader(doc, evidence, pageRef.count);

      // Case Summary
      renderSectionTitle(doc, '1. Case Summary');
      renderField(doc, 'Dispute ID', evidence.disputeId);
      renderField(doc, 'Transaction ID', evidence.transactionId);
      renderField(doc, 'Invoice ID', evidence.invoiceId);
      renderField(doc, 'Dispute Amount', `${evidence.disputeAmount.value} ${evidence.disputeAmount.currency_code}`);
      renderField(doc, 'Dispute Reason', evidence.disputeReason);
      renderField(doc, 'Report Generated', new Date().toISOString());
      renderField(doc, 'Evidence Hash', crypto.createHash('sha256')
        .update(JSON.stringify(evidence))
        .digest('hex')
        .substring(0, 16) + '...');
      doc.moveDown(1);

      // Section 2: Delivery Evidence
      if (evidence.deliveryTimestamps.length > 0) {
        ensureSpace(doc, evidence, pageRef, 150);
        renderSectionTitle(doc, '2. Delivery Evidence');

        for (const delivery of evidence.deliveryTimestamps) {
          ensureSpace(doc, evidence, pageRef, 80);
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(`• ${delivery.description}`, MARGIN + 10, doc.y, {
              width: CONTENT_WIDTH - 10,
            });
          doc.font('Helvetica');
          renderField(doc, '  Delivered At', delivery.deliveredAt);
          if (delivery.trackingNumber) {
            renderField(doc, '  Tracking', `${delivery.trackingNumber} (${delivery.carrier || 'N/A'})`);
          }
          if (delivery.recipientName) {
            renderField(doc, '  Recipient', delivery.recipientName);
          }
          doc.moveDown(0.3);
        }
        doc.moveDown(0.5);
      }

      // Section 3: IP Activity Logs
      if (evidence.ipLogs.length > 0) {
        ensureSpace(doc, evidence, pageRef, 150);
        renderSectionTitle(doc, '3. IP Activity Logs');

        // Table header
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('Timestamp', MARGIN, doc.y, { width: 140, continued: false });

        for (const log of evidence.ipLogs) {
          ensureSpace(doc, evidence, pageRef, 40);
          doc
            .fontSize(9)
            .font('Helvetica')
            .text(
              `${log.timestamp}  |  ${log.ipAddress}  |  ${log.action}`,
              MARGIN + 10,
              doc.y,
              { width: CONTENT_WIDTH - 10 }
            );
          if (log.userAgent) {
            doc
              .fontSize(8)
              .fillColor('#666666')
              .text(`UA: ${log.userAgent}`, MARGIN + 20, doc.y, {
                width: CONTENT_WIDTH - 20,
              })
              .fillColor('#000000');
          }
        }
        doc.moveDown(0.5);
      }

      // Section 4: SHA-256 Content Hashes
      if (evidence.contentHashes.length > 0) {
        ensureSpace(doc, evidence, pageRef, 150);
        renderSectionTitle(doc, '4. SHA-256 Content Integrity Hashes');

        for (const hash of evidence.contentHashes) {
          ensureSpace(doc, evidence, pageRef, 50);
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(`• ${hash.filename}`, MARGIN + 10, doc.y, {
              width: CONTENT_WIDTH - 10,
            });
          doc
            .fontSize(8)
            .font('Courier')
            .text(`SHA-256: ${hash.sha256}`, MARGIN + 20, doc.y, {
              width: CONTENT_WIDTH - 20,
            });
          doc
            .fontSize(9)
            .font('Helvetica')
            .text(
              `Uploaded: ${hash.uploadedAt} | Size: ${(hash.sizeBytes / 1024).toFixed(1)} KB`,
              MARGIN + 20,
              doc.y,
              { width: CONTENT_WIDTH - 20 }
            );
          doc.moveDown(0.3);
        }
        doc.moveDown(0.5);
      }

      // Section 5: SOW Approvals
      if (evidence.sowApprovals.length > 0) {
        ensureSpace(doc, evidence, pageRef, 150);
        renderSectionTitle(doc, '5. Statement of Work (SOW) Approvals');

        for (const sow of evidence.sowApprovals) {
          ensureSpace(doc, evidence, pageRef, 60);
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(`• ${sow.milestoneName}`, MARGIN + 10, doc.y, {
              width: CONTENT_WIDTH - 10,
            });
          renderField(doc, '  Approved At', sow.approvedAt);
          renderField(doc, '  Approved By', sow.approvedBy);
          if (sow.notes) {
            renderField(doc, '  Notes', sow.notes);
          }
          doc.moveDown(0.3);
        }
        doc.moveDown(0.5);
      }

      // Section 6: Additional Notes
      if (evidence.additionalNotes) {
        ensureSpace(doc, evidence, pageRef, 100);
        renderSectionTitle(doc, '6. Additional Notes');
        doc
          .fontSize(10)
          .font('Helvetica')
          .text(evidence.additionalNotes, MARGIN, doc.y, {
            width: CONTENT_WIDTH,
            align: 'left',
          });
        doc.moveDown(1);
      }

      // Footer
      ensureSpace(doc, evidence, pageRef, 60);
      doc
        .moveTo(MARGIN, doc.y)
        .lineTo(PAGE_WIDTH - MARGIN, doc.y)
        .strokeColor('#CCCCCC')
        .lineWidth(1)
        .stroke();

      doc.moveDown(0.5);
      doc
        .fontSize(8)
        .fillColor('#999999')
        .text(
          'This document was automatically generated by PayPal Aegis Dispute Shield. ' +
            'All timestamps are in UTC. Content hashes were computed at upload time.',
          MARGIN,
          doc.y,
          { width: CONTENT_WIDTH, align: 'center' }
        );

      doc.end();
    } catch (err) {
      logger.error('Evidence PDF compilation failed', {
        disputeId: evidence.disputeId,
        error: err instanceof Error ? err.message : String(err),
      });
      reject(err);
    }
  });
}

/**
 * Creates sample evidence data for simulation/demo mode.
 */
export function createDemoEvidenceData(dispute: PayPalDispute): EvidenceData {
  const now = new Date().toISOString();
  const oneDay = 24 * 60 * 60 * 1000;

  return {
    buyerName: 'Demo Buyer',
    buyerEmail: 'buyer@example.com',
    transactionId: `TXN-${dispute.dispute_id.substring(0, 8)}`,
    invoiceId: `INV-${Date.now().toString(36).toUpperCase()}`,
    disputeId: dispute.dispute_id,
    disputeAmount: dispute.dispute_amount,
    disputeReason: dispute.reason,
    deliveryTimestamps: [
      {
        description: 'Project milestone: Design mockups delivered',
        deliveredAt: new Date(Date.now() - 14 * oneDay).toISOString(),
        trackingNumber: 'AEGIS-DIGITAL-001',
        carrier: 'Digital Delivery',
        recipientName: 'Demo Buyer',
      },
      {
        description: 'Project milestone: Final deliverables',
        deliveredAt: new Date(Date.now() - 3 * oneDay).toISOString(),
        trackingNumber: 'AEGIS-DIGITAL-002',
        carrier: 'Digital Delivery',
        recipientName: 'Demo Buyer',
      },
    ],
    ipLogs: [
      {
        timestamp: new Date(Date.now() - 14 * oneDay).toISOString(),
        ipAddress: '192.168.1.100',
        action: 'Buyer approved milestone #1',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      {
        timestamp: new Date(Date.now() - 7 * oneDay).toISOString(),
        ipAddress: '192.168.1.100',
        action: 'Buyer downloaded deliverables',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      {
        timestamp: new Date(Date.now() - 3 * oneDay).toISOString(),
        ipAddress: '192.168.1.100',
        action: 'Buyer approved final milestone',
      },
    ],
    contentHashes: [
      {
        filename: 'design-mockups-v3.pdf',
        sha256: crypto.createHash('sha256').update('demo-mockups').digest('hex'),
        uploadedAt: new Date(Date.now() - 14 * oneDay).toISOString(),
        sizeBytes: 2_450_000,
      },
      {
        filename: 'final-deliverables.zip',
        sha256: crypto.createHash('sha256').update('demo-deliverables').digest('hex'),
        uploadedAt: new Date(Date.now() - 3 * oneDay).toISOString(),
        sizeBytes: 8_120_000,
      },
    ],
    sowApprovals: [
      {
        milestoneName: 'Milestone 1: Design Phase',
        approvedAt: new Date(Date.now() - 14 * oneDay).toISOString(),
        approvedBy: 'Demo Buyer (buyer@example.com)',
        notes: 'Client approved design mockups via platform',
      },
      {
        milestoneName: 'Milestone 2: Development Phase',
        approvedAt: new Date(Date.now() - 3 * oneDay).toISOString(),
        approvedBy: 'Demo Buyer (buyer@example.com)',
        notes: 'Client approved final deliverables and signed off SOW',
      },
    ],
    additionalNotes:
      'All deliverables were approved by the buyer through the PayPal Aegis platform. ' +
      'Digital delivery confirmations and SHA-256 content hashes are available for all files. ' +
      'The buyer acknowledged receipt and approved each milestone before payment capture.',
  };
}
