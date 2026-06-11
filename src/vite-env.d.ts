/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string | undefined
  readonly VITE_SSE_BASE_URL: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
