import { Eye, EyeOff } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

import { Button } from './button'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
	({ className, type, ...props }, ref) => {
		const [showPassword, setShowPassword] = React.useState(false)

		const togglePassword = () => {
			setShowPassword((prev) => !prev)
		}

		return (
			<div className="relative">
				<input
					className={cn(
						'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
						type === 'password' && 'pr-10',
						className,
					)}
					ref={ref}
					type={type === 'password' && showPassword ? 'text' : type}
					{...props}
				/>
				{type === 'password' && (
					<Button
						className="absolute right-0 top-0 h-full px-3 py-1 hover:bg-transparent"
						onClick={togglePassword}
						size="icon"
						type="button"
						variant="ghost"
					>
						{showPassword ? (
							<EyeOff aria-hidden="true" className="size-4" />
						) : (
							<Eye aria-hidden="true" className="size-4" />
						)}
						<span className="sr-only">
							{showPassword ? 'Hide password' : 'Show password'}
						</span>
					</Button>
				)}
			</div>
		)
	},
)
Input.displayName = 'Input'

export { Input }
