#!/usr/bin/env node

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const updateEnvVar = (content, key, value) => {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${value}`);
  }
  return content + `\n${key}=${value}`;
};

const getTelegramProxyConfig = () => {
  const proxyType = (process.env.TELEGRAM_PROXY_TYPE || '').trim().toLowerCase();
  const proxyHost = (process.env.TELEGRAM_PROXY_HOST || '').trim();
  const proxyPort = Number.parseInt(process.env.TELEGRAM_PROXY_PORT || '', 10);

  if (!proxyType || !proxyHost || !Number.isFinite(proxyPort) || proxyPort <= 0) {
    return null;
  }

  if (proxyType !== 'socks5' && proxyType !== 'socks4') {
    console.warn(`⚠️ Unsupported TELEGRAM_PROXY_TYPE="${proxyType}". Supported values: socks5, socks4`);
    return null;
  }

  return {
    ip: proxyHost,
    port: proxyPort,
    socksType: proxyType === 'socks4' ? 4 : 5,
    username: (process.env.TELEGRAM_PROXY_USERNAME || '').trim() || undefined,
    password: (process.env.TELEGRAM_PROXY_PASSWORD || '').trim() || undefined,
    timeout: Math.max(
      5,
      Number.parseInt(process.env.TELEGRAM_PROXY_TIMEOUT_SECONDS || '10', 10) || 10
    )
  };
};

const pngPath = path.resolve(__dirname, '../../telegram-login-qr.png');

const saveSessionToEnv = (sessionString) => {
  const envPath = path.resolve(__dirname, '../../.env');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  envContent = updateEnvVar(envContent, 'TELEGRAM_API_ID', process.env.TELEGRAM_API_ID || '');
  envContent = updateEnvVar(envContent, 'TELEGRAM_API_HASH', process.env.TELEGRAM_API_HASH || '');
  envContent = updateEnvVar(envContent, 'TELEGRAM_PHONE', process.env.TELEGRAM_PHONE || '');
  envContent = updateEnvVar(envContent, 'TELEGRAM_SESSION', sessionString);
  fs.writeFileSync(envPath, envContent.trim() + '\n');
};

const main = async () => {
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;

  if (!apiId || !apiHash) {
    throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in .env');
  }

  const proxy = getTelegramProxyConfig();
  if (proxy) {
    console.log(
      `🌐 Using ${proxy.socksType === 4 ? 'SOCKS4' : 'SOCKS5'} proxy ${proxy.ip}:${proxy.port} for Telegram QR setup`
    );
  }

  const client = new TelegramClient(new StringSession(''), parseInt(apiId, 10), apiHash, {
    connectionRetries: 5,
    proxy
  });

  try {
    await client.connect();

    console.log('Open Telegram on your phone: Settings -> Devices -> Link Desktop Device');
    console.log('Scan the QR code below.\n');

    const user = await client.signInUserWithQrCode(
      { apiId: parseInt(apiId, 10), apiHash },
      {
        qrCode: async ({ token, expires }) => {
          const loginUrl = `tg://login?token=${token.toString('base64url')}`;
          console.log(`QR expires at: ${new Date(expires * 1000).toISOString()}`);
          qrcode.generate(loginUrl, { small: true });
          console.log(loginUrl);
          await QRCode.toFile(pngPath, loginUrl, {
            margin: 1,
            width: 512
          });
          console.log(`PNG saved to: ${pngPath}`);
        },
        password: async () => {
          if (process.env.TELEGRAM_PASSWORD) {
            return process.env.TELEGRAM_PASSWORD;
          }
          return question('Enter Telegram 2FA password: ');
        },
        onError: async (error) => {
          console.error('QR login error:', error.message);
          return false;
        }
      }
    );

    const sessionString = client.session.save();
    saveSessionToEnv(sessionString);

    console.log('\nAuthenticated as:');
    console.log(JSON.stringify({
      id: String(user.id),
      username: user.username || null,
      firstName: user.firstName || null
    }, null, 2));
    console.log('\nTELEGRAM_SESSION saved to .env');
  } finally {
    try {
      await client.disconnect();
    } catch {}
    rl.close();
  }
};

main().catch((error) => {
  console.error('\nQR setup failed:', error.message);
  rl.close();
  process.exit(1);
});
