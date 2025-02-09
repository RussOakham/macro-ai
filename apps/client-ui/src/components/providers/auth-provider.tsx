import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// TODO: Build out further
// TODO: Add way to initialize store at app start
// TODO: Rename file to auth-store.ts and create store file for each store
// Ref: https://blog.stackademic.com/zustand-for-authentication-in-react-apps-156b6294129c
// Ref: https://doichevkostia.dev/blog/authentication-store-with-zustand/
// Ref: 

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
