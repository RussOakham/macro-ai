import { AuthLoading } from './auth-loading'

/**
 * Full-screen authentication loading component for route transitions
 * Used specifically for the index route's beforeLoad authentication check
 *
 * This component provides a full-screen loading state that appears during:
 * - Initial authentication validation
 * - Token refresh processes
 * - Route transitions with authentication checks
 * @returns React component for full-screen authentication loading
 */
const AuthRouteLoading: React.FC = () => {
	return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<AuthLoading
				message="Verifying authentication..."
				showIcon
				size="lg"
				className="min-h-[50vh]"
			/>
		</div>
	)
}

export { AuthRouteLoading }
