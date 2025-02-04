import Axios from 'axios'

const axios = Axios.create({
	baseURL: 'http://localhost:3030/api',
})

export { axios }
