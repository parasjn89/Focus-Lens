const FORBIDDEN_MEDIA_KEYS = new Set([
  'video',
  'image',
  'frame',
  'screenshot',
  'audio',
  'audioblob',
  'media',
  'rawframe',
  'webcamframe',
  'screenframe',
  'audiodata',
  'videostream',
]);

function containsForbiddenMediaKey(obj) {
  if (!obj || typeof obj !== 'object') return false;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (containsForbiddenMediaKey(item)) return true;
    }
    return false;
  }

  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    if (FORBIDDEN_MEDIA_KEYS.has(lowerKey)) {
      return true;
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (containsForbiddenMediaKey(obj[key])) return true;
    }
  }

  return false;
}

export async function privacyGuard(request, reply) {
  if (request.body && containsForbiddenMediaKey(request.body)) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Privacy Violation',
      message: 'Privacy Policy Violation: FocusLens backend strictly rejects raw media payloads (video, image, screenshot, audio). Only derived statistical metadata is permitted.',
    });
  }
}
