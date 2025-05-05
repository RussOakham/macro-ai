import { useEffect } from 'react'
import { NavigationMenuList } from '@radix-ui/react-navigation-menu'
import { Link } from '@tanstack/react-router'

import { cn } from '@/lib/utils'
import { useIsAuthenticated } from '@/services/hooks/auth/useIsAuthenticated'

import {
	NavigationMenu,
	NavigationMenuItem,
	navigationMenuTriggerStyle,
} from '../../navigation-menu'

import { DesktopAuthButtons } from './desktop-auth-buttons'

const DesktopNav = ({
	className,
	...props
}: React.ComponentPropsWithoutRef<'nav'>) => {
	const isAuthenticated = useIsAuthenticated()

	useEffect(() => {
		console.log('isAuthenticated', isAuthenticated)
	}, [isAuthenticated])

	return (
		<nav className={cn('flex p-2 gap-2', className)} {...props}>
			<div className="flex justify-between w-full">
				<NavigationMenu>
					<NavigationMenuList>
						<NavigationMenuItem asChild>
							<Link
								to="/"
								className={navigationMenuTriggerStyle({
									className: '[&.active]:font-bold',
								})}
							>
								Home
							</Link>
						</NavigationMenuItem>
					</NavigationMenuList>
				</NavigationMenu>

				<NavigationMenu>
					<NavigationMenuList>
						<DesktopAuthButtons isAuthed={isAuthenticated} />
					</NavigationMenuList>
				</NavigationMenu>
			</div>
		</nav>
	)
}

export { DesktopNav }
