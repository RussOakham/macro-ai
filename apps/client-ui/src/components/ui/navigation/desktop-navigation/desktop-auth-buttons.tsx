import { Link } from '@tanstack/react-router'

import { usePostLogoutMutation } from '@/services/auth/hooks/usePostLogoutMutation'

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
					type="button"
					onClick={() => {
						useLogout()
					}}
					className={navigationMenuTriggerStyle({
						className: '[&.active]:font-bold',
					})}
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
					to="/auth/login"
					className={navigationMenuTriggerStyle({
						className: '[&.active]:font-bold',
					})}
				>
					Login
				</Link>
			</NavigationMenuItem>
			<NavigationMenuItem asChild>
				<Link
					to="/auth/register"
					className={navigationMenuTriggerStyle({
						className: '[&.active]:font-bold',
					})}
				>
					Register
				</Link>
			</NavigationMenuItem>
		</>
	)
}

export { DesktopAuthButtons }
