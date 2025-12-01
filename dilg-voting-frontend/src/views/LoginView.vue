<!-- src/views/LoginView.vue -->
<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const voterId = ref('')
const pin = ref('')
const localError = ref('')
const localMessage = ref('')

const handleLogin = async () => {
  localError.value = ''
  localMessage.value = ''

  if (!voterId.value || !pin.value) {
    localError.value = 'Voter ID and PIN are required.'
    return
  }

  try {
    await authStore.login(voterId.value.trim(), pin.value.trim())
    localMessage.value = `Welcome, ${authStore.voter.name}. Redirecting...`
    router.push('/vote')
  } catch (error) {
    localError.value = authStore.error || 'Login failed.'
  }
}
</script>

<template>
  <div class="min-h-[70vh] flex items-center justify-center px-4">
    <div class="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div class="text-center space-y-1">
        <p class="text-xs uppercase tracking-wide text-emerald-600 font-semibold">HCAD Alumni</p>
        <h1 class="text-2xl font-semibold">Voter Login</h1>
        <p class="text-xs text-slate-500">Enter the Voter ID and PIN given by the admin.</p>
      </div>

      <div class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">Voter ID</label>
          <input
            v-model="voterId"
            type="text"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="e.g. HCAD-0001"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">PIN</label>
          <input
            v-model="pin"
            type="password"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="6-digit PIN"
          />
        </div>

        <button
          @click="handleLogin"
          :disabled="authStore.loading"
          class="w-full inline-flex justify-center items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-emerald-700"
        >
          <span v-if="authStore.loading">Logging in...</span>
          <span v-else>Login</span>
        </button>

        <div class="min-h-[32px]">
          <p v-if="localMessage" class="text-xs text-emerald-600">
            {{ localMessage }}
          </p>
          <p v-if="localError" class="text-xs text-rose-600">
            {{ localError }}
          </p>
        </div>
      </div>

      <div class="text-[11px] text-slate-500 text-center space-y-1">
        <p>Need a Voter ID? Contact the HCAD Alumni office (President/COMELEC) for verification.</p>
        <RouterLink to="/info" class="text-emerald-700 font-semibold">See registration instructions</RouterLink>
      </div>
    </div>
  </div>
</template>
