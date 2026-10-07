// Derives a session's acquisition channel and device info from the request's
// user agent plus what the game client reports. Only the referrer's host is
// kept, never the full URL.

// In-app browsers often send no referrer, so their user agent is the best hint
const IN_APP_BROWSERS = [
  [/Instagram/i, 'instagram'],
  [/FBAN|FBAV|FB_IAB/i, 'facebook'],
  [/WhatsApp/i, 'whatsapp'],
  [/TikTok|musical_ly|BytedanceWebview/i, 'tiktok'],
  [/Twitter/i, 'twitter'],
  [/LinkedInApp/i, 'linkedin'],
  [/Telegram/i, 'telegram'],
];

const REFERRER_CHANNELS = [
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'twitter'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin'],
  [/(^|\.)(t\.me|telegram\.org)$/, 'telegram'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
];

function clean(value, max = 60) {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().toLowerCase().slice(0, max);
  return v || undefined;
}

function referrerHostOf(referrer, ownHost) {
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    // Navigation within our own site isn't an acquisition source
    return host && host !== ownHost?.replace(/^www\./, '') ? host : undefined;
  } catch {
    return undefined;
  }
}

function parseUserAgent(ua, isTouch) {
  const inApp = IN_APP_BROWSERS.find(([re]) => re.test(ua))?.[1];

  let os = 'other';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'ios';
  else if (/Android/.test(ua)) os = 'android';
  else if (/Windows/.test(ua)) os = 'windows';
  // iPadOS reports itself as a Mac; touch support gives it away
  else if (/Macintosh/.test(ua)) os = isTouch ? 'ios' : 'macos';
  else if (/Linux|CrOS/.test(ua)) os = 'linux';

  let deviceType = 'desktop';
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) || (/Macintosh/.test(ua) && isTouch)) {
    deviceType = 'tablet';
  } else if (/Mobi|iPhone|iPod|Android/.test(ua)) {
    deviceType = 'mobile';
  }

  let browser = 'other';
  if (inApp) browser = `${inApp} in-app`;
  else if (/SamsungBrowser/.test(ua)) browser = 'samsung internet';
  else if (/Edg\//.test(ua)) browser = 'edge';
  else if (/Firefox|FxiOS/.test(ua)) browser = 'firefox';
  else if (/Chrome|CriOS/.test(ua)) browser = 'chrome';
  else if (/Safari/.test(ua)) browser = 'safari';

  return { inApp, os, deviceType, browser };
}

/**
 * @param {import('express').Request} req - session-start request; body may hold
 *   referrer, utmSource, utmMedium, utmCampaign, orientation, screenWidth, screenHeight, isTouch
 */
export function buildSessionSource(req) {
  const b = req.body ?? {};
  const { inApp, os, deviceType, browser } = parseUserAgent(req.get('user-agent') ?? '', b.isTouch === true);
  const referrerHost = referrerHostOf(b.referrer, req.hostname);
  const utmSource = clean(b.utmSource);

  const channel =
    utmSource ||
    inApp ||
    (referrerHost && (REFERRER_CHANNELS.find(([re]) => re.test(referrerHost))?.[1] ?? referrerHost)) ||
    'direct';

  return {
    channel,
    referrerHost,
    utmSource,
    utmMedium: clean(b.utmMedium),
    utmCampaign: clean(b.utmCampaign, 100),
    deviceType,
    os,
    browser,
    orientation: ['portrait', 'landscape'].includes(b.orientation) ? b.orientation : undefined,
    screenWidth: Number.isInteger(b.screenWidth) ? b.screenWidth : undefined,
    screenHeight: Number.isInteger(b.screenHeight) ? b.screenHeight : undefined,
  };
}
