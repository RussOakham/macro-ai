import { Link } from '@tanstack/react-router'

import { usePostLogoutMutation } from '@/services/hooks/auth/use-post-logout-mutation'

import {
	NavigationMenuItem,
	navigationMenuTriggerStyle,
} from '../../navigation-menu'

interface IDesktopAuthButtonsProps {
	isAuthed: boolean
}

const DesktopAuthButtons = ({ isAuthed }: IDesktopAuthButtonsProps) => {
	const { mutate: useLogout } = usePostLogoutMutation()

	if (isAuthed) {
		return (
			<NavigationMenuItem asChild>
				<button
					className={navigationMenuTriggerStyle({
						className: '[&.active]:font-bold',
					})}
					onClick={() => {
						useLogout()
					}}
					type="button"
				>
					Logout
				</button>
			</NavigationMenuItem>
		)
	}

	return (
		<>
			<NavigationMenuItem asChild>
				<Link
					className={navigationMenuTriggerStyle({
						className: '[&.active]:font-bold',
					})}
					to="/auth/login"
				>
					Login
				</Link>
			</NavigationMenuItem>
			<NavigationMenuItem asChild>
				<Link
					className={navigationMenuTriggerStyle({
						className: '[&.active]:font-bold',
					})}
					to="/auth/register"
				>
					Register
				</Link>
			</NavigationMenuItem>
		</>
	)
}

export { DesktopAuthButtons }
