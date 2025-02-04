import { StrictMode } from 'react'
import './index.css'

import { routeTree } from './routeTree.gen.ts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './components/providers/theme-provider.tsx'

// Create a new Query Client instance
const queryClient = new QueryClient()

// Create a new router instance
const router = createRouter({
	routeTree,
	context: { queryClient },
	defaultPreload: 'intent',
	defaultPreloadStaleTime: 0,
})

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
				<QueryClientProvider client={queryClient}>
					<RouterProvider router={router} />
					<ReactQueryDevtools
						initialIsOpen={false}
						buttonPosition="bottom-right"
					/>
				</QueryClientProvider>
			</ThemeProvider>
		</StrictMode>,
	)
}
