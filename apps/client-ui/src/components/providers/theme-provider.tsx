import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system' | null | undefined

interface ThemeProviderProps {
	children: React.ReactNode
	defaultTheme?: Theme
	storageKey?: string
}

interface ThemeProviderState {
	setTheme: (theme: Theme) => void
	theme: Theme
}

const initialState: ThemeProviderState = {
	setTheme: () => null,
	theme: 'system',
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

const ThemeProvider = ({
	children,
	defaultTheme = 'system',
	storageKey = 'macro-ai-ui-theme',
	...props
}: ThemeProviderProps) => {
	const [theme, setTheme] = useState<Theme>(() => {
		const storedTheme = localStorage.getItem(storageKey) as Theme

		if (!storedTheme) {
			return defaultTheme
		}

		return storedTheme
	})

	useEffect(() => {
		const root = globalThis.window.document.documentElement

		root.classList.remove('light', 'dark')

		if (!theme) {
			return
		}

		if (theme === 'system') {
			const systemTheme = globalThis.window.matchMedia(
				'(prefers-color-scheme: dark)',
			).matches
				? 'dark'
				: 'light'

			root.classList.add(systemTheme)
			return
		}

		root.classList.add(theme)
	}, [theme])

	const value = {
		setTheme: (theme: Theme) => {
			if (!theme) {
				return
			}
			localStorage.setItem(storageKey, theme)
			setTheme(theme)
		},
		theme,
	}

	return (
		<ThemeProviderContext.Provider {...props} value={value}>
			{children}
		</ThemeProviderContext.Provider>
	)
}

const useTheme = () => {
	const context = useContext(ThemeProviderContext)

	return context
}

export { ThemeProvider, useTheme }
