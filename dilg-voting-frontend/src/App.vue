<script setup>
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { computed, ref } from 'vue'
import { useAuthStore } from './stores/auth'
import { useAdminAuthStore } from './stores/adminAuth'
import Logo from './assets/HCAD_Alumni_Org_Logo.jpg'

const authStore = useAuthStore()
const adminAuth = useAdminAuthStore()
const route = useRoute()
const mobileMenuOpen = ref(false)

authStore.initFromStorage()
adminAuth.initFromStorage()

const isAdminContext = computed(() => {
  const name = route.name ? route.name.toString() : ''
  return name.startsWith('admin')
})

const voterLinks = computed(() => {
  const links = [
    { to: '/', label: 'Home', show: !authStore.isAuthenticated },
    { to: '/info', label: 'Registration', show: !authStore.isAuthenticated },
    { to: '/nomination', label: 'Nomination', show: authStore.isAuthenticated },
    { to: '/vote', label: 'Ballot', show: authStore.isAuthenticated },
    { to: '/results', label: 'Results', show: authStore.isAuthenticated },
  ]
  return links.filter((l) => l.show)
})
</script>

<template>
  <div class="min-h-screen text-slate-800 app-shell">
    <header class="header-bar sticky top-0 z-20">
      <div class="relative max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <img
            :src="Logo"
            alt="HCAD Alumni"
            class="h-12 w-12 rounded-full border border-emerald-100 object-cover bg-white shadow-sm"
          />
          <div>
            <p class="text-sm font-semibold">
              {{ isAdminContext ? 'HCAD Admin Console' : 'HCAD Alumni Election System' }}
            </p>
            <p class="text-[11px] text-slate-500">
              {{ isAdminContext ? 'COMELEC / Staff access' : 'Holy Cross Academy of Digos Alumni Association' }}
            </p>
          </div>
        </div>

        <!-- Admin header -->
        <template v-if="isAdminContext">
          <div class="flex items-center gap-2 text-[11px] text-slate-600">
            <div v-if="adminAuth.isAuthenticated" class="hidden sm:block text-right">
              <p class="font-semibold">Admin: {{ adminAuth.admin?.full_name || adminAuth.admin?.username }}</p>
            </div>
            <RouterLink
              v-if="adminAuth.isAuthenticated"
              to="/admin"
              class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs shadow-sm hover:bg-emerald-700 text-white admin-dashboard-link"
            >
              Dashboard
            </RouterLink>
            <RouterLink v-else to="/admin-login" class="px-3 py-1.5 rounded-lg border text-xs hover:bg-slate-100">Admin Login</RouterLink>
          </div>
        </template>

        <!-- Voter/landing header -->
        <template v-else>
          <nav class="hidden sm:flex items-center gap-2 text-xs font-medium">
            <RouterLink
              v-for="link in voterLinks"
              :key="link.to"
              :to="link.to"
              class="px-3 py-1.5 rounded-lg hover:bg-slate-100"
              active-class="bg-emerald-50 text-emerald-700"
            >
              {{ link.label }}
            </RouterLink>
          </nav>

          <div class="flex items-center gap-2 text-[11px] text-slate-600">
            <div v-if="authStore.isAuthenticated" class="hidden sm:block text-right">
              <p class="font-semibold">{{ authStore.voter?.name }}</p>
              <p>Voter ID: {{ authStore.voter?.voter_id }}</p>
            </div>
            <RouterLink
              v-if="!authStore.isAuthenticated"
              to="/login"
              class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs shadow-sm hover:bg-emerald-700 voter-login-link"
            >
              Voter Login
            </RouterLink>
            <button
              v-else
              @click="authStore.logout(); $router.push('/login')"
              class="px-3 py-1.5 rounded-lg border border-slate-300 text-xs hover:bg-slate-100"
            >
              Logout
            </button>
          </div>

          <!-- Mobile burger -->
          <button
            class="sm:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg border border-slate-200 bg-white/80 shadow-sm"
            @click="mobileMenuOpen = !mobileMenuOpen"
            aria-label="Toggle navigation"
          >
            <svg v-if="!mobileMenuOpen" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div
            v-if="mobileMenuOpen"
            class="sm:hidden absolute top-full right-4 mt-2 w-56 rounded-2xl border border-slate-200 bg-white shadow-xl p-3 space-y-2"
          >
            <div v-if="authStore.isAuthenticated" class="text-xs text-slate-700 border-b border-slate-100 pb-2 mb-2">
              <p class="font-semibold">{{ authStore.voter?.name }}</p>
              <p>Voter ID: {{ authStore.voter?.voter_id }}</p>
            </div>
            <RouterLink
              v-for="link in voterLinks"
              :key="link.to"
              :to="link.to"
              class="block px-3 py-2 rounded-lg text-xs hover:bg-slate-100"
              active-class="bg-emerald-50 text-emerald-700"
              @click="mobileMenuOpen = false"
            >
              {{ link.label }}
            </RouterLink>
            <RouterLink
              v-if="!authStore.isAuthenticated"
              to="/login"
              class="block px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs shadow-sm hover:bg-emerald-700"
              @click="mobileMenuOpen = false"
            >
              Voter Login
            </RouterLink>
            <button
              v-else
              @click="authStore.logout(); $router.push('/login'); mobileMenuOpen = false"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-left hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </template>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-3 sm:px-4 py-6">
      <RouterView />
    </main>
  </div>
</template>

<style>
:root {
  --hcad-navy: #0f2342;
  --hcad-gold: #c4973c;
  --hcad-ivory: #f8f6f1;
  --hcad-sage: #dbe2cf;
  --hcad-navy-dark: #0b1a31;
  --hcad-gold-dark: #a77e2e;
}

.app-shell {
  background: radial-gradient(circle at 15% 20%, rgba(196, 151, 60, 0.12), transparent 30%),
    radial-gradient(circle at 80% 0%, rgba(15, 35, 66, 0.08), transparent 28%),
    linear-gradient(180deg, #f9fafb 0%, #f1f4f8 100%);
}

/* Accessibility: larger default sizing for elderly users */
body {
  font-size: 18px;
  line-height: 1.6;
}
.text-xs {
  font-size: 0.95rem !important;
}
.text-sm {
  font-size: 1.05rem !important;
}
input,
select,
textarea {
  font-size: 1rem !important;
  padding: 0.55rem 0.75rem !important;
}
button {
  font-size: 1rem !important;
}

.header-bar {
  background: linear-gradient(90deg, rgba(15, 35, 66, 0.08), rgba(196, 151, 60, 0.12), rgba(255, 255, 255, 0.92));
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(15, 35, 66, 0.08);
  box-shadow: 0 4px 18px rgba(15, 35, 66, 0.06);
}

.header-bar a.router-link-active {
  color: var(--hcad-navy);
  background: linear-gradient(90deg, rgba(196, 151, 60, 0.16), rgba(15, 35, 66, 0.08));
  transition: all 160ms ease;
}
.admin-dashboard-link {
  color: #ffffff !important;
}
.voter-login-link {
  color: #ffffff !important;
}

/* Palette overrides for Tailwind greens to align with HCAD brand */
.bg-emerald-600,
.hover\:bg-emerald-600:hover {
  background-color: var(--hcad-navy) !important;
}
.hover\:bg-emerald-700:hover,
.bg-emerald-700 {
  background-color: var(--hcad-navy-dark) !important;
}
.bg-emerald-50 {
  background-color: rgba(196, 151, 60, 0.08) !important;
}
.text-emerald-600,
.text-emerald-700 {
  color: var(--hcad-navy) !important;
}
.border-emerald-200\/70,
.border-emerald-100 {
  border-color: rgba(196, 151, 60, 0.5) !important;
}
.bg-emerald-500 {
  background-color: var(--hcad-gold) !important;
}
.hover\:bg-emerald-50:hover {
  background-color: rgba(196, 151, 60, 0.12) !important;
}
.bg-emerald-50\/30 {
  background-color: rgba(196, 151, 60, 0.15) !important;
}
.text-emerald-50 {
  color: var(--hcad-ivory) !important;
}

/* Pills / tabs */
.router-link-active {
  border-color: rgba(196, 151, 60, 0.4) !important;
}

/* Buttons with borders */
.border {
  border-color: rgba(15, 35, 66, 0.08);
}
</style>
