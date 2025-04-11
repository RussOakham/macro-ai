import { NavigationMenuList } from '@radix-ui/react-navigation-menu'
import { Link } from '@tanstack/react-router'

import { cn } from '@/lib/utils'

import {
	NavigationMenu,
	NavigationMenuItem,
	navigationMenuTriggerStyle,
} from '../../navigation-menu'

import { DesktopAuthButtons } from './desktop-auth-buttons'

interface IDesktopNavProps extends React.ComponentPropsWithoutRef<'nav'> {
	isAuthed: boolean
}

const DesktopNav = ({ isAuthed, className, ...props }: IDesktopNavProps) => {
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
						<DesktopAuthButtons isAuthed={isAuthed} />
					</NavigationMenuList>
				</NavigationMenu>
			</div>
		</nav>
	)
}

export { DesktopNav }
