// Server-side environment access. Only the public anon key is used — LeadOS never
// needs (and must never be given) the Supabase service-role key.

export function supabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }
  return { url, anonKey };
}

/** Optional comma-separated allowlist of emails that may use the app. */
export function allowedEmails(): string[] | null {
  const raw = process.env.LEADOS_ALLOWED_EMAILS?.trim();
  if (!raw) return null;
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  const list = allowedEmails();
  if (!list) return true;
  return Boolean(email && list.includes(email.toLowerCase()));
}
