import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			className="toaster group"
			toastOptions={{
				classNames: {
					actionButton:
						'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
					cancelButton:
						'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
					description: 'group-[.toast]:text-muted-foreground',
					toast: props.richColors
						? // Removed everything where shadcn+tailwind affected the colors
							'group-[.toaster]:border group-[.toaster]:shadow-lg'
						: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:shadow-lg',
				},
			}}
			{...props}
		/>
	)
}

export { Toaster }
