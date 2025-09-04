/**
 * Application Wrapper
 *
 * This component wraps the application. MSW mocking is handled by vitest setup.
 */

interface AppWrapperProps {
	children: React.ReactNode
}

export const AppWrapper = ({ children }: AppWrapperProps) => {
	return <>{children}</>
}
