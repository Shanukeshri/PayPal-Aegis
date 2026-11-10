/**
 * Dispute Shield — Multipart/Related Evidence Uploader
 *
 * Builds a multipart/related request with boundary "---AegisBoundary"
 * and uploads evidence PDFs to PayPal's provide-evidence endpoint.
 *
 * Part 1: application/json — evidence metadata
 * Part 2: application/pdf — binary PDF buffer
 *
 * POST /v1/customer/disputes/{id}/provide-evidence
 */

import axios from 'axios';
import { config } from '../../config';
import logger from '../../lib/logger';
import { store } from '../../lib/store';

const BOUNDARY = '---AegisBoundary';

export interface EvidenceMetadata {
  evidence_type: 'PROOF_OF_FULFILLMENT' | 'PROOF_OF_DELIVERY_SIGNATURE' | 'PROOF_OF_REFUND' | 'OTHER';
  evidence_info: {
    tracking_info?: Array<{
      carrier_name: string;
      tracking_number: string;
    }>;
    refund_ids?: string[];
  };
  notes: string;
}

export interface EvidenceUploadResult {
  success: boolean;
  disputeId: string;
  statusCode: number;
  response: Record<string, unknown>;
  simulated: boolean;
}

/**
 * Gets a valid OAuth2 access token for PayPal API calls.
 */
async function getAccessToken(): Promise<string | null> {
  if (!config.paypal.isConfigured) {
    return null;
  }

  try {
    const response = await axios.post<{ access_token: string }>(
      `${config.paypal.sandboxBaseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: {
          username: config.paypal.clientId,
          password: config.paypal.clientSecret,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );
    return response.data.access_token;
  } catch (err) {
    logger.error('Failed to obtain OAuth token for evidence upload', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Builds a multipart/related body buffer for the provide-evidence request.
 *
 * Structure:
 * --{BOUNDARY}
 * Content-Type: application/json; charset=UTF-8
 * Content-Disposition: form-data; name="input"
 *
 * {evidence metadata JSON}
 * --{BOUNDARY}
 * Content-Type: application/pdf
 * Content-Disposition: form-data; name="file1"; filename="evidence.pdf"
 *
 * {PDF binary data}
 * --{BOUNDARY}--
 */
function buildMultipartBody(
  metadata: EvidenceMetadata,
  pdfBuffer: Buffer
): Buffer {
  const CRLF = '\r\n';

  const metadataJson = JSON.stringify(metadata);

  const parts: Buffer[] = [];

  // Part 1: JSON metadata
  parts.push(Buffer.from(
    `--${BOUNDARY}${CRLF}` +
    `Content-Type: application/json; charset=UTF-8${CRLF}` +
    `Content-Disposition: form-data; name="input"${CRLF}` +
    `${CRLF}` +
    `${metadataJson}${CRLF}`
  ));

  // Part 2: PDF binary
  parts.push(Buffer.from(
    `--${BOUNDARY}${CRLF}` +
    `Content-Type: application/pdf${CRLF}` +
    `Content-Disposition: form-data; name="file1"; filename="evidence.pdf"${CRLF}` +
    `${CRLF}`
  ));
  parts.push(pdfBuffer);
  parts.push(Buffer.from(`${CRLF}`));

  // Closing boundary
  parts.push(Buffer.from(`--${BOUNDARY}--${CRLF}`));

  return Buffer.concat(parts);
}

/**
 * Generates a simulated successful evidence upload response.
 */
function generateSimulatedResponse(
  disputeId: string,
  metadata: EvidenceMetadata,
  pdfSizeBytes: number
): EvidenceUploadResult {
  const response = {
    links: [
      {
        href: `${config.paypal.sandboxBaseUrl}/v1/customer/disputes/${disputeId}`,
        rel: 'self',
        method: 'GET',
      },
    ],
    _simulated: true,
    _metadata: {
      evidence_type: metadata.evidence_type,
      notes: metadata.notes,
      pdf_size_bytes: pdfSizeBytes,
      uploaded_at: new Date().toISOString(),
    },
  };

  return {
    success: true,
    disputeId,
    statusCode: 200,
    response,
    simulated: true,
  };
}

/**
 * Uploads evidence to PayPal's provide-evidence endpoint.
 *
 * @param disputeId - The PayPal dispute ID
 * @param metadata - Evidence metadata (type, tracking info, notes)
 * @param pdfBuffer - The compiled evidence PDF as a Buffer
 * @returns EvidenceUploadResult
 */
export async function uploadEvidence(
  disputeId: string,
  metadata: EvidenceMetadata,
  pdfBuffer: Buffer
): Promise<EvidenceUploadResult> {
  logger.info('Uploading evidence for dispute', {
    disputeId,
    evidenceType: metadata.evidence_type,
    pdfSizeBytes: pdfBuffer.length,
    pdfSizeMB: (pdfBuffer.length / (1024 * 1024)).toFixed(2),
  });

  // Get access token
  const token = await getAccessToken();

  if (!token) {
    // Simulation mode
    logger.info('PayPal not configured — simulating evidence upload', { disputeId });

    const result = generateSimulatedResponse(disputeId, metadata, pdfBuffer.length);

    store.addAuditEntry('EVIDENCE_UPLOADED', {
      disputeId,
      evidenceType: metadata.evidence_type,
      pdfSizeBytes: pdfBuffer.length,
      simulated: true,
    });

    return result;
  }

  // Build multipart body
  const body = buildMultipartBody(metadata, pdfBuffer);

  try {
    const response = await axios.post<Record<string, unknown>>(
      `${config.paypal.sandboxBaseUrl}/v1/customer/disputes/${disputeId}/provide-evidence`,
      body,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${BOUNDARY}`,
          'Content-Length': body.length.toString(),
        },
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024,
      }
    );

    logger.info('Evidence uploaded successfully', {
      disputeId,
      statusCode: response.status,
    });

    store.addAuditEntry('EVIDENCE_UPLOADED', {
      disputeId,
      evidenceType: metadata.evidence_type,
      pdfSizeBytes: pdfBuffer.length,
      statusCode: response.status,
      simulated: false,
    });

    return {
      success: true,
      disputeId,
      statusCode: response.status,
      response: response.data,
      simulated: false,
    };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const statusCode = err.response?.status || 0;
      const errorData = err.response?.data as Record<string, unknown> | undefined;

      // Handle INVALID_EVIDENCE_FILE specifically
      if (
        errorData &&
        typeof errorData.name === 'string' &&
        errorData.name === 'INVALID_EVIDENCE_FILE'
      ) {
        logger.error('PayPal rejected evidence file as INVALID_EVIDENCE_FILE', {
          disputeId,
          statusCode,
          errorData,
        });

        store.addAuditEntry('EVIDENCE_UPLOAD_REJECTED', {
          disputeId,
          reason: 'INVALID_EVIDENCE_FILE',
          statusCode,
          details: errorData,
        });

        return {
          success: false,
          disputeId,
          statusCode,
          response: errorData || { error: 'INVALID_EVIDENCE_FILE' },
          simulated: false,
        };
      }

      logger.error('Evidence upload failed with HTTP error', {
        disputeId,
        statusCode,
        error: err.message,
        responseData: errorData,
      });

      store.addAuditEntry('EVIDENCE_UPLOAD_FAILED', {
        disputeId,
        statusCode,
        error: err.message,
      });

      return {
        success: false,
        disputeId,
        statusCode,
        response: errorData || { error: err.message },
        simulated: false,
      };
    }

    logger.error('Evidence upload failed with unexpected error', {
      disputeId,
      error: err instanceof Error ? err.message : String(err),
    });

    return {
      success: false,
      disputeId,
      statusCode: 0,
      response: { error: err instanceof Error ? err.message : String(err) },
      simulated: false,
    };
  }
}
