const crypto = require('crypto');
const axios = require('axios');

const trimSlash = (value) => String(value || '').replace(/\/+$/g, '');

const encodePath = (value) => String(value)
  .split('/')
  .map((part) => encodeURIComponent(part))
  .join('/');

const hmac = (key, value, encoding) => crypto
  .createHmac('sha256', key)
  .update(value)
  .digest(encoding);

const sha256 = (value, encoding = 'hex') => crypto
  .createHash('sha256')
  .update(value)
  .digest(encoding);

const formatAmzDate = (date) => date.toISOString()
  .replace(/[:-]|\.\d{3}/g, '');

const getSigningKey = ({ secretAccessKey, dateStamp, region }) => {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const dateRegionKey = hmac(dateKey, region);
  const dateRegionServiceKey = hmac(dateRegionKey, 's3');
  return hmac(dateRegionServiceKey, 'aws4_request');
};

const getConfig = () => ({
  endpoint: process.env.MEDIA_S3_ENDPOINT || process.env.S3_ENDPOINT,
  bucket: process.env.MEDIA_S3_BUCKET || process.env.S3_BUCKET,
  region: process.env.MEDIA_S3_REGION || process.env.S3_REGION || 'ru-1',
  accessKeyId: process.env.MEDIA_S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.MEDIA_S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY,
  publicBaseUrl: process.env.MEDIA_S3_PUBLIC_BASE_URL || process.env.S3_PUBLIC_BASE_URL
});

const isConfigured = () => {
  const config = getConfig();
  return Boolean(config.endpoint && config.bucket && config.accessKeyId && config.secretAccessKey);
};

const buildPublicUrl = ({ config, key }) => {
  if (config.publicBaseUrl) {
    return `${trimSlash(config.publicBaseUrl)}/${key}`;
  }

  return `${trimSlash(config.endpoint)}/${config.bucket}/${key}`;
};

const uploadBuffer = async ({ key, buffer, mimeType, cacheControl = 'public, max-age=31536000, immutable' }) => {
  const config = getConfig();
  if (!isConfigured()) {
    throw new Error('S3 media storage is not configured');
  }

  const endpoint = new URL(config.endpoint);
  const pathname = `/${encodeURIComponent(config.bucket)}/${encodePath(key)}`;
  const url = `${trimSlash(config.endpoint)}${pathname}`;
  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(buffer);
  const headers = {
    'cache-control': cacheControl,
    'content-type': mimeType || 'application/octet-stream',
    host: endpoint.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate
  };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((name) => `${name}:${headers[name]}`)
    .join('\n') + '\n';
  const canonicalRequest = [
    'PUT',
    pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest)
  ].join('\n');
  const signature = hmac(getSigningKey({
    secretAccessKey: config.secretAccessKey,
    dateStamp,
    region: config.region
  }), stringToSign, 'hex');
  const authorization = [
    'AWS4-HMAC-SHA256',
    `Credential=${config.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(', ');

  try {
    await axios.put(url, buffer, {
      headers: {
        ...headers,
        Authorization: authorization
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: (status) => status >= 200 && status < 300
    });
  } catch (error) {
    const status = error.response?.status;
    const text = typeof error.response?.data === 'string'
      ? error.response.data
      : JSON.stringify(error.response?.data || {});
    throw new Error(`S3 upload failed${status ? ` with ${status}` : ''}: ${text.slice(0, 300)}`);
  }

  return {
    url: buildPublicUrl({ config, key }),
    s3: {
      bucket: config.bucket,
      key,
      endpoint: trimSlash(config.endpoint),
      region: config.region
    }
  };
};

module.exports = {
  isConfigured,
  uploadBuffer
};
