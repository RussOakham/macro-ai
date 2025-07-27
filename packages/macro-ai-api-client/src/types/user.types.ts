// User API Types - auto-generated, do not edit manually

export interface UserGetUsersByIdResponse {
	user: {
		id: string
		email: string
		emailVerified: boolean
		firstName: string
		lastName: string
		createdAt: string
		updatedAt: string
		lastLogin: string
	}
}

export interface UserGetUsersMeResponse {
	user: {
		id: string
		email: string
		emailVerified: boolean
		firstName: string
		lastName: string
		createdAt: string
		updatedAt: string
		lastLogin: string
	}
}
