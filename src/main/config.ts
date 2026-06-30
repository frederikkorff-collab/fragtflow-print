/**
 * Build-time defaults for the FragtFlow print client.
 *
 * The Supabase anon (publishable) key is intentionally embedded — it is a
 * public key, safe to ship in client software. The print client authenticates
 * to the print-queue function with its per-station `token` (configured by the
 * user), not with this key. The anon key only gets the request past the
 * Supabase API gateway.
 */
export const DEFAULT_API_URL =
  'https://empejpiyqxatnsjmbmqc.supabase.co/functions/v1/print-queue'

export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtcGVqcGl5cXhhdG5zam1ibXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjQ3MjksImV4cCI6MjA5NDI0MDcyOX0.uEzIKINQB_SHOrku8BtOaGNZxRdnXbSw4zv9Mf7a4xk'

/** Default poll interval (ms). The backend rate limits gently; 5s is plenty. */
export const DEFAULT_POLL_INTERVAL = 5000
