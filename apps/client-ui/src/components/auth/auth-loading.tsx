import { Loader2, Shield } from 'lucide-react'

interface AuthLoadingProps {
	message?: string
	showIcon?: boolean
	size?: 'sm' | 'md' | 'lg'
	className?: string
}

/**
 * Authentication loading component
 * Displays during authentication validation and token refresh processes
 *
 * Features:
 * - Consistent with existing design system using semantic color tokens
 * - Supports light/dark/system theme toggle functionality
 * - Matches chat interface loading patterns
 * - Configurable size and messaging
 */
const AuthLoading: React.FC<AuthLoadingProps> = ({
	message = 'Authenticating...',
	showIcon = true,
	size = 'md',
	className = '',
}) => {
	// Size configurations
	const sizeConfig = {
		sm: {
			spinner: 'h-6 w-6',
			icon: 'h-5 w-5',
			text: 'text-sm',
			spacing: 'mb-2',
			gap: 'gap-2',
		},
		md: {
			spinner: 'h-8 w-8',
			icon: 'h-6 w-6',
			text: 'text-base',
			spacing: 'mb-4',
			gap: 'gap-3',
		},
		lg: {
			spinner: 'h-10 w-10',
			icon: 'h-8 w-8',
			text: 'text-lg',
			spacing: 'mb-6',
			gap: 'gap-4',
		},
	}

	const config = sizeConfig[size]

	return (
		<div
			className={`flex-1 flex items-center justify-center bg-background h-full ${className}`}
		>
			<div className="text-center">
				<div
					className={`flex items-center justify-center ${config.gap} ${config.spacing}`}
				>
					{showIcon && <Shield className={`${config.icon} text-primary`} />}
					<Loader2
						className={`${config.spinner} text-foreground animate-spin`}
					/>
				</div>
				<p className={`text-muted-foreground ${config.text}`}>{message}</p>
			</div>
		</div>
	)
}

/**
 * Compact authentication loading component for inline use
 * Useful for smaller loading states within forms or components
 */
const AuthLoadingCompact: React.FC<{ message?: string }> = ({
	message = 'Authenticating...',
}) => {
	return (
		<div className="flex items-center justify-center gap-2 p-4">
			<Loader2 className="h-4 w-4 text-foreground animate-spin" />
			<span className="text-sm text-muted-foreground">{message}</span>
		</div>
	)
}

export { AuthLoading, AuthLoadingCompact }
