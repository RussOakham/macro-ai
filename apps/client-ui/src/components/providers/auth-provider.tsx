import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface IUser {
	email: string
	accessToken: string
	refreshToken: string
}

interface IAuthStore {
	user: IUser | null
	setUser: (user: IUser) => void
}

const useAuthStore = create<IAuthStore>()(
	devtools((set) => ({
		user: null,
		setUser: (user) => {
			set((state) => ({ ...state, user }))
		},
	})),
)

export { useAuthStore }
