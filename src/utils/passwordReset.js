/**
 * Extracts password reset action parameters from URL search, continueUrl, or hash.
 * Never logs or exposes parameter values.
 *
 * @param {Location|Object} [loc] - window.location or mock location object
 * @returns {{ oobCode: string|null, mode: string|null, token: string|null, email: string|null }}
 */
export function parseResetParams(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc) return { oobCode: null, mode: null, token: null, email: null };

  const searchParams = new URLSearchParams(loc.search || '');
  let oobCode = searchParams.get('oobCode');
  let mode = searchParams.get('mode');
  let token = searchParams.get('token');
  let email = searchParams.get('email');

  // Check nested continueUrl if present (e.g. Firebase action handler redirects)
  const continueUrl = searchParams.get('continueUrl');
  if (continueUrl) {
    try {
      const continueParams = new URL(continueUrl).searchParams;
      if (!oobCode) oobCode = continueParams.get('oobCode');
      if (!mode) mode = continueParams.get('mode');
      if (!token) token = continueParams.get('token');
      if (!email) email = continueParams.get('email');
    } catch (e) {}
  }

  // Check hash fallback (e.g. #/reset-password?oobCode=...)
  if (!oobCode && loc.hash && loc.hash.includes('oobCode=')) {
    try {
      const hashQuery = loc.hash.includes('?') ? loc.hash.split('?')[1] : loc.hash.replace(/^#\/?/, '');
      const hashParams = new URLSearchParams(hashQuery);
      if (!oobCode) oobCode = hashParams.get('oobCode');
      if (!mode) mode = hashParams.get('mode');
      if (!token) token = hashParams.get('token');
      if (!email) email = hashParams.get('email');
    } catch (e) {}
  }

  return {
    oobCode: oobCode ? oobCode.trim() : null,
    mode: mode || (oobCode ? 'resetPassword' : null),
    token: token ? token.trim() : null,
    email: email ? email.trim() : null,
  };
}
