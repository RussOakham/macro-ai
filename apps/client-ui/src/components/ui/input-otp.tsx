import { OTPInput, OTPInputContext } from 'input-otp'
import { Minus } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

const InputOTP = React.forwardRef<
	React.ComponentRef<typeof OTPInput>,
	React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
	<OTPInput
		className={cn('disabled:cursor-not-allowed', className)}
		containerClassName={cn(
			'flex items-center gap-2 has-[:disabled]:opacity-50',
			containerClassName,
		)}
		ref={ref}
		{...props}
	/>
))
InputOTP.displayName = 'InputOTP'

const InputOTPGroup = React.forwardRef<
	React.ComponentRef<'div'>,
	React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
	<div className={cn('flex items-center', className)} ref={ref} {...props} />
))
InputOTPGroup.displayName = 'InputOTPGroup'

const InputOTPSlot = React.forwardRef<
	React.ComponentRef<'div'>,
	React.ComponentPropsWithoutRef<'div'> & { index: number }
>(({ className, index, ...props }, ref) => {
	const inputOTPContext = React.useContext(OTPInputContext)
	const slot = inputOTPContext.slots[index]
	const { char, hasFakeCaret, isActive } = slot ?? {}

	return (
		<div
			className={cn(
				'relative flex h-9 w-9 items-center justify-center border-y border-r border-input text-sm shadow-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md',
				isActive && 'z-10 ring-1 ring-ring',
				className,
			)}
			ref={ref}
			{...props}
		>
			{char}
			{hasFakeCaret && (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
				</div>
			)}
		</div>
	)
})
InputOTPSlot.displayName = 'InputOTPSlot'

const InputOTPSeparator = React.forwardRef<
	React.ComponentRef<'div'>,
	React.ComponentPropsWithoutRef<'div'>
>(({ ...props }, ref) => (
	<div ref={ref} role="separator" {...props}>
		<Minus />
	</div>
))
InputOTPSeparator.displayName = 'InputOTPSeparator'

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot }
