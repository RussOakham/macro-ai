import Axios, { AxiosRequestConfig } from 'axios'

const axiosConfig: AxiosRequestConfig = {
	baseURL: 'http://localhost:3030/api',
	headers: {
		'Content-Type': 'application/json',
	},
}

const axios = Axios.create(axiosConfig)

const axiosWithCredentials = Axios.create({
	...axiosConfig,
	withCredentials: true,
})

export { axios, axiosWithCredentials }
