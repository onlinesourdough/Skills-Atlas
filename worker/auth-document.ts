export const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );

// The body is an internal template; every interpolated provider value is escaped at its call site.
export function authDocument(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} · Skills Atlas</title><link rel="icon" href="/favicon.png"><link rel="stylesheet" href="/auth.css"></head><body class="auth-page"><main class="auth-card"><span class="auth-brand">Skill Atlas</span>${body}</main></body></html>`;
}

export function authErrorDocument(): string {
  return authDocument(
    "Connection unavailable",
    '<h1>This connection could not be completed</h1><p>The request may have expired, or your access could not be verified. Return to Atlas to check your account, then start a fresh connection from your agent.</p><a href="/">Return to Atlas</a>',
  );
}
