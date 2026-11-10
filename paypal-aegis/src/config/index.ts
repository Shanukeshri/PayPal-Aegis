import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AppConfig {
  port: number;
  nodeEnv: string;
  frontendUrl: string;
  paypal: {
    clientId: string;
    clientSecret: string;
    sandboxBaseUrl: string;
    webhookId: string;
    sandboxBuyerEmail: string;
    sandboxBuyerPassword: string;
    isConfigured: boolean;
  };
  redis: {
    url: string;
    isConfigured: boolean;
  };
  elasticsearch: {
    url: string;
    apiKey: string;
    isConfigured: boolean;
  };
  channel3: {
    apiKey: string;
    baseUrl: string;
    isConfigured: boolean;
  };
  openai: {
    apiKey: string;
    model: string;
    isConfigured: boolean;
  };
  render: {
    workflowApiKey: string;
    isConfigured: boolean;
  };
  demo: {
    hmacSecret: string;
  };
  session: {
    secret: string;
  };
  hitl: {
    approvalSecret: string;
  };
}

function getEnv(key: string, defaultValue = ''): string {
  return process.env[key]?.trim() || defaultValue;
}

export function loadConfig(): AppConfig {
  const paypalClientId = getEnv('PAYPAL_CLIENT_ID');
  const paypalClientSecret = getEnv('PAYPAL_CLIENT_SECRET');
  const redisUrl = getEnv('REDIS_URL');
  const esUrl = getEnv('ELASTICSEARCH_URL');
  const esApiKey = getEnv('ELASTICSEARCH_API_KEY');
  const ch3ApiKey = getEnv('CHANNEL3_API_KEY');
  const openaiApiKey = getEnv('OPENAI_API_KEY');
  const renderApiKey = getEnv('RENDER_WORKFLOW_API_KEY');

  return {
    port: parseInt(getEnv('PORT', '3001'), 10),
    nodeEnv: getEnv('NODE_ENV', 'development'),
    frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:3000'),
    paypal: {
      clientId: paypalClientId,
      clientSecret: paypalClientSecret,
      sandboxBaseUrl: getEnv('PAYPAL_SANDBOX_BASE_URL', 'https://api-m.sandbox.paypal.com'),
      webhookId: getEnv('PAYPAL_WEBHOOK_ID'),
      sandboxBuyerEmail: getEnv('PAYPAL_SANDBOX_BUYER_EMAIL'),
      sandboxBuyerPassword: getEnv('PAYPAL_SANDBOX_BUYER_PASSWORD'),
      isConfigured: !!(paypalClientId && paypalClientSecret),
    },
    redis: {
      url: redisUrl,
      isConfigured: !!redisUrl,
    },
    elasticsearch: {
      url: esUrl,
      apiKey: esApiKey,
      isConfigured: !!(esUrl && esApiKey),
    },
    channel3: {
      apiKey: ch3ApiKey,
      baseUrl: getEnv('CHANNEL3_BASE_URL', 'https://api.trychannel3.com'),
      isConfigured: !!ch3ApiKey,
    },
    openai: {
      apiKey: openaiApiKey,
      model: getEnv('LLM_MODEL', 'gpt-4o'),
      isConfigured: !!openaiApiKey,
    },
    render: {
      workflowApiKey: renderApiKey,
      isConfigured: !!renderApiKey,
    },
    demo: {
      hmacSecret: getEnv('DEMO_HMAC_SECRET', 'aegis-demo-secret-key'),
    },
    session: {
      secret: getEnv('SESSION_SECRET', 'aegis-session-secret'),
    },
    hitl: {
      approvalSecret: getEnv('HITL_APPROVAL_SECRET', 'aegis-hitl-secret'),
    },
  };
}

export const config = loadConfig();

