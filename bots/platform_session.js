const https = require('https');
const crypto = require('crypto');

const cache = new Map();

function getPlatformSession(platform, userId, botToken, publicKey) {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id <= 0) return Promise.resolve(null);
    const cacheKey = `${platform}:${id}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.data);
    const timestamp = Date.now();
    const signature = crypto.createHmac('sha256', botToken)
        .update(`bot_session\n${platform}\n${id}\n${timestamp}`).digest('hex');
    const payload = JSON.stringify({ action: 'bot_session', platform, userId: id, timestamp, signature });
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'zjagjauwmpuzcwzidhkn.supabase.co',
            path: '/functions/v1/platform-auth',
            method: 'POST',
            headers: {
                apikey: publicKey,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            timeout: 15000
        }, (res) => {
            let text = '';
            res.on('data', chunk => text += chunk);
            res.on('end', () => {
                try {
                    const data = JSON.parse(text);
                    if (res.statusCode !== 200 || !data.access_token) return resolve(null);
                    // Supabase access tokens live 1 hour; reuse them for 50 minutes instead of minting a session per button press.
                    cache.set(cacheKey, { data, expiresAt: Date.now() + 50 * 60 * 1000 });
                    resolve(data);
                } catch { resolve(null); }
            });
        });
        req.on('timeout', () => req.destroy());
        req.on('error', () => resolve(null));
        req.write(payload);
        req.end();
    });
}

function confirmPlatformCode(platform, userId, code, botToken, publicKey) {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id <= 0 || !/^auth_[a-z0-9_-]{8,64}$/i.test(code)) return Promise.resolve(false);
    const timestamp = Date.now();
    const signature = crypto.createHmac('sha256', botToken)
        .update(`confirm_code\n${platform}\n${id}\n${code}\n${timestamp}`).digest('hex');
    const payload = JSON.stringify({ action: 'confirm_code', platform, userId: id, code, timestamp, signature });
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'zjagjauwmpuzcwzidhkn.supabase.co',
            path: '/functions/v1/platform-auth',
            method: 'POST',
            headers: { apikey: publicKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
            timeout: 15000
        }, (res) => {
            let text = '';
            res.on('data', chunk => text += chunk);
            res.on('end', () => {
                try { resolve(res.statusCode === 200 && JSON.parse(text)?.ok === true); }
                catch { resolve(false); }
            });
        });
        req.on('timeout', () => req.destroy());
        req.on('error', () => resolve(false));
        req.write(payload);
        req.end();
    });
}

module.exports = { getPlatformSession, confirmPlatformCode };
