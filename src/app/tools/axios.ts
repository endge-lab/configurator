import axios from 'axios'

export const axiosAuth = axios.create({
  baseURL: import.meta.env.VITE_APP_API_AUTH_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})
