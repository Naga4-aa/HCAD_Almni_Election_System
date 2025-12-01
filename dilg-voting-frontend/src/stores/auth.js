import { defineStore } from 'pinia'
import api, { setAuthToken } from '../api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('voterToken') || '',
    voter: localStorage.getItem('voterData') ? JSON.parse(localStorage.getItem('voterData')) : null,
    loading: false,
    error: '',
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
  },

  actions: {
    initFromStorage() {
      if (this.token) {
        setAuthToken(this.token)
      }
    },

    async login(voter_id, pin) {
      this.loading = true
      this.error = ''

      try {
        const res = await api.post('voter/login/', { voter_id, pin })

        this.token = res.data.token
        this.voter = res.data.voter

        localStorage.setItem('voterToken', this.token)
        localStorage.setItem('voterData', JSON.stringify(this.voter))

        setAuthToken(this.token)
      } catch (error) {
        console.error(error)
        if (error.response?.data?.error) {
          this.error = error.response.data.error
        } else {
          this.error = 'Login failed. Please try again.'
        }
        throw error
      } finally {
        this.loading = false
      }
    },

    logout() {
      this.token = ''
      this.voter = null
      this.error = ''
      localStorage.removeItem('voterToken')
      localStorage.removeItem('voterData')
      setAuthToken(null)
    },
  },
})
