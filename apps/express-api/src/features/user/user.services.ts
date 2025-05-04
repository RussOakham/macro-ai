import {
	createUser,
	findUserById,
	updateLastLogin,
} from './user.data-access.ts'

// Register or login user by id - ID is Cognito user id
const registerOrLoginUserById = async (id: string, email: string) => {
	let user = await findUserById(id)

	if (!user) {
		user = await createUser(id, email)
	} else {
		user = await updateLastLogin(id)
	}

	return user
}

const getUserById = async (id: string) => {
	const user = await findUserById(id)

	if (!user) {
		return null
	}

	return user
}

export { getUserById, registerOrLoginUserById }
