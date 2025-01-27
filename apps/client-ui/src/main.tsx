import { StrictMode } from 'react'
import './index.css'

import { routeTree } from './routeTree.gen.ts'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './components/providers/theme-provider.tsx'

// Create a new router instance
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router
	}
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement)
	root.render(
		<StrictMode>
			<ThemeProvider defaultTheme="system" storageKey="macro-ai-ui-theme">
				<RouterProvider router={router} />
			</ThemeProvider>
		</StrictMode>,
	)
}
