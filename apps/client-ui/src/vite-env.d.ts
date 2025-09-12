/// <reference types="vite/client" />

interface ImportMeta {
	readonly env: ImportMetaEnv
}

interface ImportMetaEnv {
	readonly VITE_API_KEY: string
	readonly VITE_API_URL: string
}
