
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** BabyBlues backend address, e.g. http://localhost:3000 */
  readonly VITE_API_BASE_URL?: string;
  /** Region for crisis contacts, e.g. IN */
  readonly VITE_REGION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
