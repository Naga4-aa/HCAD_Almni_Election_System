<!-- src/views/AdminDashboard.vue -->
<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'
import { useAdminAuthStore } from '../stores/adminAuth'
import { useRouter } from 'vue-router'

const adminStore = useAdminAuthStore()
const router = useRouter()

const stats = ref(null)
const tally = ref([])
const nominations = ref([])
const reminders = ref([])
const loading = ref(false)
const errorMessage = ref('')
const promotingId = ref(null)
const election = ref(null)
const timelineMode = ref('timeline') // 'timeline' | 'demo'
const savingElection = ref(false)
const electionError = ref('')
const electionMessage = ref('')
const publishingResults = ref(false)
const publishedResults = ref(null)
const loadingPublishedResults = ref(false)
const demoMessage = ref('')
const demoError = ref('')
const electionForm = ref({
  name: '',
  description: '',
  nomination_start: '',
  nomination_end: '',
  voting_start: '',
  voting_end: '',
  results_at: '',
  is_active: true,
})
const notifications = ref([])
const unreadNotifications = ref(0)
const notificationsLoading = ref(false)
const notificationsError = ref('')
const notificationsCollapsed = ref(false)
const showHistory = ref(false)
const recentVoters = ref([])

const pruneRecentVoters = () => {
  const cutoff = Date.now() - 30 * 60 * 1000 // 30 minutes
  recentVoters.value = recentVoters.value.filter((v) => v.createdAt >= cutoff)
}

// Voters
const voters = ref([])
const loadingVoters = ref(false)
const addVoterModal = ref(false)
const voterSubmitting = ref(false)
const voterError = ref('')
const newVoter = ref({
  name: '',
  batch_year: '',
  campus_chapter: 'Digos City',
  email: '',
  phone: '',
  privacy_consent: true,
  pin: '',
})
const resettingVoters = ref(false)
const resetPins = ref(false)
const resettingElection = ref(false)

// UI state: show one section at a time
const activeSection = ref('stats')
const sections = [
  { key: 'stats', label: 'Stats' },
  { key: 'tally', label: 'Tally' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'nominations', label: 'Nominations' },
  { key: 'reminders', label: 'Reminders' },
  { key: 'voters', label: 'Voters' },
]

const toInput = (val) => {
  if (!val) return ''
  return String(val).slice(0, 16)
}

const formatDateTime = (val) => {
  if (!val) return ''
  const d = new Date(val)
  return d.toLocaleString()
}

const loadStats = async () => {
  const res = await api.get('admin/stats/')
  stats.value = res.data
}

const loadTally = async () => {
  const res = await api.get('admin/tally/')
  tally.value = res.data || []
}

const loadPublishedResults = async () => {
  loadingPublishedResults.value = true
  try {
    const res = await api.get('elections/results/')
    publishedResults.value = res.data?.published ? res.data : null
  } catch (err) {
    publishedResults.value = null
  } finally {
    loadingPublishedResults.value = false
  }
}

const loadNominations = async () => {
  const res = await api.get('admin/nominations/')
  nominations.value = res.data || []
}

const loadReminders = async () => {
  try {
    const res = await api.get('admin/reminders/')
    reminders.value = res.data || []
  } catch (err) {
    reminders.value = []
  }
}

const loadNotifications = async () => {
  notificationsLoading.value = true
  try {
    const res = await api.get(`admin/notifications/${showHistory.value ? '?history=1' : ''}`)
    notifications.value = res.data?.items || []
    unreadNotifications.value = res.data?.unread_count || 0
    notificationsError.value = ''
  } catch (err) {
    notificationsError.value = err.response?.data?.error || 'Failed to load notifications.'
  } finally {
    notificationsLoading.value = false
  }
}

const markAllNotificationsRead = async () => {
  try {
    await api.post('admin/notifications/', { action: 'mark_all_read' })
    await loadNotifications()
  } catch (err) {
    notificationsError.value = err.response?.data?.error || 'Failed to mark notifications as read.'
  }
}

const dismissNotification = async (id) => {
  try {
    await api.post('admin/notifications/', { action: 'dismiss', ids: [id] })
    await loadNotifications()
  } catch (err) {
    notificationsError.value = err.response?.data?.error || 'Failed to dismiss notification.'
  }
}

const deleteNotification = async (id) => {
  try {
    await api.post('admin/notifications/', { action: 'delete', ids: [id] })
    await loadNotifications()
  } catch (err) {
    notificationsError.value = err.response?.data?.error || 'Failed to delete notification.'
  }
}

const resetVoterPin = async (voter) => {
  if (!window.confirm(`Reset PIN for ${voter.name}? This will end any active session.`)) return
  try {
    const res = await api.post(`admin/voters/${voter.id}/reset-pin/`)
    alert(`PIN reset.\nVoter ID: ${res.data.voter_id}\nPIN: ${res.data.pin}`)
    pruneRecentVoters()
    recentVoters.value.unshift({
      id: voter.id,
      name: voter.name,
      voter_id: res.data.voter_id,
      pin: res.data.pin,
      createdAt: Date.now(),
      source: 'Reset',
    })
    await loadVoters()
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to reset PIN.')
  }
}

const exportRecentVotersCsv = () => {
  pruneRecentVoters()
  if (!recentVoters.value.length) {
    alert('No recent credentials to export (last 30 minutes).')
    return
  }
  const header = ['Name', 'Voter ID', 'PIN', 'Source', 'Generated At']
  const rows = recentVoters.value.map((v) => [
    v.name,
    v.voter_id,
    v.pin,
    v.source || 'New',
    new Date(v.createdAt).toLocaleString(),
  ])
  const csv = [header, ...rows]
    .map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `voters_credentials_${Date.now()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const loadElection = async () => {
  try {
    const res = await api.get('admin/election/active/')
    election.value = res.data
    timelineMode.value = res.data.mode || 'timeline'
    electionForm.value = {
      name: res.data.name || '',
      description: res.data.description || '',
      nomination_start: toInput(res.data.nomination_start),
      nomination_end: toInput(res.data.nomination_end),
      voting_start: toInput(res.data.voting_start),
      voting_end: toInput(res.data.voting_end),
      results_at: toInput(res.data.results_at),
      is_active: res.data.is_active,
    }
    electionError.value = ''
  } catch (err) {
    if (err.response?.status === 404) {
      // No election yet; allow creating from the dashboard UI.
      election.value = null
      timelineMode.value = 'timeline'
      electionForm.value = {
        name: '',
        description: '',
        nomination_start: '',
        nomination_end: '',
        voting_start: '',
        voting_end: '',
        results_at: '',
        is_active: true,
      }
      electionError.value = ''
    } else {
      electionError.value = err.response?.data?.error || 'Failed to load election timeline.'
      election.value = null
    }
  }
}

const saveElection = async () => {
  if (!electionForm.value.name.trim()) {
    electionError.value = 'Election name is required.'
    return
  }
  savingElection.value = true
  electionError.value = ''
  electionMessage.value = ''
  try {
    const isUpdate = !!election.value
    const payload = {
      name: electionForm.value.name,
      description: electionForm.value.description,
      nomination_start: electionForm.value.nomination_start,
      nomination_end: electionForm.value.nomination_end,
      voting_start: electionForm.value.voting_start,
      voting_end: electionForm.value.voting_end,
      results_at: electionForm.value.results_at,
      is_active: electionForm.value.is_active,
      mode: 'timeline',
    }
    const res = isUpdate
      ? await api.put('admin/election/active/', payload)
      : await api.post('admin/election/active/', payload)
    election.value = res.data
    timelineMode.value = res.data.mode || 'timeline'
    electionMessage.value = isUpdate ? 'Timeline saved.' : 'Election created.'
  } catch (err) {
    electionError.value = err.response?.data?.error || 'Failed to save timeline.'
  } finally {
    savingElection.value = false
  }
}

const publishResults = async (publishFlag) => {
  publishingResults.value = true
  electionError.value = ''
  try {
    const res = await api.post('admin/election/publish/', { publish: publishFlag })
    election.value = res.data
    electionMessage.value = publishFlag ? 'Results published.' : 'Results unpublished.'
    await loadPublishedResults()
  } catch (err) {
    electionError.value = err.response?.data?.error || 'Failed to update results status.'
  } finally {
    publishingResults.value = false
  }
}

const triggerDemoPhase = async (action) => {
  demoError.value = ''
  demoMessage.value = ''
  try {
    const res = await api.post('admin/election/demo-phase/', { action })
    election.value = res.data
    timelineMode.value = res.data.mode || timelineMode.value
    electionForm.value = {
      name: res.data.name || '',
      description: res.data.description || '',
      nomination_start: toInput(res.data.nomination_start),
      nomination_end: toInput(res.data.nomination_end),
      voting_start: toInput(res.data.voting_start),
      voting_end: toInput(res.data.voting_end),
      results_at: toInput(res.data.results_at),
      is_active: res.data.is_active,
    }
    demoMessage.value = action === 'exit_demo' ? 'Returned to timeline mode.' : 'Demo phase updated.'
  } catch (err) {
    demoError.value = err.response?.data?.error || 'Failed to update demo phase.'
  }
}

const switchMode = async (mode) => {
  if (!election.value || mode === timelineMode.value) return
  demoError.value = ''
  demoMessage.value = ''
  electionError.value = ''
  try {
    const res = await api.put('admin/election/active/', { mode })
    election.value = res.data
    timelineMode.value = res.data.mode || mode
    electionForm.value = {
      name: res.data.name || '',
      description: res.data.description || '',
      nomination_start: toInput(res.data.nomination_start),
      nomination_end: toInput(res.data.nomination_end),
      voting_start: toInput(res.data.voting_start),
      voting_end: toInput(res.data.voting_end),
      results_at: toInput(res.data.results_at),
      is_active: res.data.is_active,
    }
    demoMessage.value = mode === 'demo'
      ? 'Demo mode enabled. Use the buttons below to jump phases.'
      : 'Returned to timeline mode.'
  } catch (err) {
    const msg = err.response?.data?.error || 'Failed to change mode.'
    demoError.value = msg
    electionError.value = msg
  }
}

const resetElection = async () => {
  const confirmReset = window.confirm('Reset votes, nominations, and voter statuses for this election?')
  if (!confirmReset) return
  resettingElection.value = true
  try {
    const res = await api.post('admin/reset-election/', {})
    alert(res.data?.message || 'Election reset.')
    await Promise.all([loadTally(), loadPublishedResults(), loadNominations(), loadStats(), loadElection(), loadVoters()])
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to reset election.')
  } finally {
    resettingElection.value = false
  }
}

const promote = async (nom) => {
  promotingId.value = nom.id
  try {
    const res = await api.post(`admin/nominations/${nom.id}/promote/`)
    const created = !!res.data?.created
    await Promise.all([loadTally(), loadPublishedResults(), loadNominations()])
    if (created) {
      alert('Nomination promoted to candidate.')
    } else {
      alert('Already a candidate for this position.')
    }
  } catch (err) {
    errorMessage.value = err.response?.data?.error || 'Failed to promote nomination.'
  } finally {
    promotingId.value = null
  }
}

const logout = () => {
  adminStore.logout()
  router.push('/admin-login')
}

const loadVoters = async () => {
  loadingVoters.value = true
  try {
    const res = await api.get('admin/voters/')
    voters.value = res.data || []
  } catch (err) {
    voterError.value = 'Failed to load voters.'
  } finally {
    loadingVoters.value = false
  }
}

const openAddVoter = () => {
  newVoter.value = {
    name: '',
    batch_year: '',
    campus_chapter: 'Digos City',
    email: '',
    phone: '',
    privacy_consent: true,
    pin: '',
  }
  voterError.value = ''
  addVoterModal.value = true
}

const submitVoter = async () => {
  voterSubmitting.value = true
  voterError.value = ''
  try {
    const res = await api.post('admin/voters/', {
      name: newVoter.value.name,
      batch_year: newVoter.value.batch_year,
      campus_chapter: newVoter.value.campus_chapter,
      email: newVoter.value.email,
      phone: newVoter.value.phone,
      privacy_consent: newVoter.value.privacy_consent,
      pin: newVoter.value.pin,
    })
    await loadVoters()
    addVoterModal.value = false
    alert(`Voter created.\nVoter ID: ${res.data.voter_id}\nPIN: ${res.data.pin || newVoter.value.pin || 'N/A'}`)
    pruneRecentVoters()
    recentVoters.value.unshift({
      id: res.data.id || Date.now(),
      name: newVoter.value.name,
      voter_id: res.data.voter_id,
      pin: res.data.pin || newVoter.value.pin || 'N/A',
      createdAt: Date.now(),
      source: 'New',
    })
  } catch (err) {
    voterError.value = err.response?.data?.error || 'Failed to create voter.'
  } finally {
    voterSubmitting.value = false
  }
}

const resetAllVoters = async () => {
  const confirmReset = window.confirm('Reset has_voted and sessions for all voters?')
  if (!confirmReset) return
  resettingVoters.value = true
  try {
    const res = await api.post('admin/reset-voters/', { reset_pins: resetPins.value })
    alert(res.data?.message || 'Voters reset.')
    await loadVoters()
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to reset voters.')
  } finally {
    resettingVoters.value = false
  }
}

onMounted(async () => {
  adminStore.initFromStorage()

  if (!adminStore.isAuthenticated) {
    router.push('/admin-login')
    return
  }
  loading.value = true
  try {
    pruneRecentVoters()
    await Promise.all([
      loadStats(),
      loadTally(),
      loadPublishedResults(),
      loadNominations(),
      loadReminders(),
      loadElection(),
      loadVoters(),
      loadNotifications(),
    ])
  } catch (err) {
    errorMessage.value = 'Failed to load admin data.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-4">
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
      <div>
        <p class="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Admin</p>
        <h2 class="text-lg font-semibold">COMELEC Dashboard</h2>
        <p class="text-xs text-slate-500">Live turnout, tallies, and nominations.</p>
      </div>
      <div class="flex gap-2 items-center">
        <button @click="resetElection" :disabled="resettingElection" class="text-xs px-3 py-1.5 rounded-lg border border-rose-400 text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-60">{{ resettingElection ? 'Resetting.' : 'Reset election' }}</button>
        <button @click="logout" class="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100">Logout</button>
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">Notifications</span>
          <span class="text-[11px] px-2 py-1 rounded-full" :class="unreadNotifications ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'">
            {{ unreadNotifications }} unread
          </span>
          <button @click="notificationsCollapsed = !notificationsCollapsed" class="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100">
            {{ notificationsCollapsed ? 'Expand' : 'Collapse' }}
          </button>
          <button @click="showHistory = !showHistory; loadNotifications()" class="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100">
            {{ showHistory ? 'Hide history' : 'Show history' }}
          </button>
        </div>
        <div class="flex gap-2">
          <button @click="loadNotifications" class="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100" :disabled="notificationsLoading">Refresh</button>
          <button @click="markAllNotificationsRead" class="text-xs px-3 py-1.5 rounded-lg border border-emerald-400 text-emerald-700 bg-emerald-50" :disabled="notificationsLoading || unreadNotifications === 0">Mark all read</button>
        </div>
      </div>
      <p v-if="notificationsError" class="text-[11px] text-rose-600">{{ notificationsError }}</p>
      <div v-else-if="notificationsCollapsed" class="text-[11px] text-slate-600">Notifications collapsed.</div>
      <div v-else-if="notificationsLoading" class="text-[11px] text-slate-600">Loading notifications...</div>
      <div v-else-if="!notifications.length" class="text-[11px] text-slate-500">No notifications yet.</div>
      <ul
        v-else
        class="divide-y divide-slate-200 text-[11px] text-slate-700"
        style="max-height: 220px; overflow-y: auto;"
      >
        <li v-for="n in notifications" :key="n.id" class="py-2 flex items-start gap-2">
          <span class="mt-0.5 h-2 w-2 rounded-full" :class="n.is_read ? 'bg-slate-300' : 'bg-emerald-500'"></span>
          <div class="flex-1">
            <p class="font-semibold capitalize text-slate-800">{{ n.type }}</p>
            <p class="text-slate-700">{{ n.message }}</p>
            <p class="text-[10px] text-slate-500">{{ formatDateTime(n.created_at) }}</p>
          </div>
          <div class="flex gap-1">
            <button @click="dismissNotification(n.id)" class="text-[10px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-100">Hide</button>
            <button @click="deleteNotification(n.id)" class="text-[10px] px-2 py-1 rounded border border-rose-300 text-rose-700 hover:bg-rose-50">Delete</button>
          </div>
        </li>
      </ul>
      <p v-if="showHistory && !notificationsCollapsed" class="text-[10px] text-slate-500">History view includes hidden items; delete removes them permanently.</p>
    </div>

    <div v-if="loading" class="text-sm text-slate-500">Loading dashboard.</div>
    <p v-if="errorMessage" class="text-sm text-rose-600">{{ errorMessage }}</p>

    <div class="sticky top-16 z-10 bg-slate-50/90 backdrop-blur rounded-2xl border border-slate-200 px-3 py-2 flex flex-wrap gap-2">
      <button
        v-for="s in sections"
        :key="s.key"
        @click="activeSection = s.key"
        class="text-xs px-3 py-1.5 rounded-full border"
        :class="activeSection === s.key ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 hover:bg-slate-100'"
      >
        {{ s.label }}
      </button>
    </div>

    <div v-if="activeSection === 'stats' && stats" id="stats" class="grid gap-3 md:grid-cols-3">
      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <p class="text-xs text-slate-500">Total voters</p>
        <p class="text-2xl font-semibold">{{ stats.total_voters }}</p>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <p class="text-xs text-slate-500">Voted</p>
        <p class="text-2xl font-semibold">{{ stats.voted_count }}</p>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <p class="text-xs text-slate-500">Turnout</p>
        <p class="text-2xl font-semibold">{{ stats.turnout_percent }}%</p>
      </div>
    </div>

    <div v-if="activeSection === 'tally'" id="tally" class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 class="text-sm font-semibold mb-3">Per-position tally</h3>
      <div class="grid gap-4 md:grid-cols-2">
        <div v-for="pos in tally" :key="pos.position_id" class="border border-slate-100 rounded-xl p-3 space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold">{{ pos.position }}</p>
            <span class="text-[11px] text-slate-500">{{ pos.candidates.length }} candidate(s)</span>
          </div>
          <div class="space-y-2">
            <div v-for="cand in pos.candidates" :key="cand.candidate_id" class="text-sm">
              <div class="flex justify-between mb-1">
                <span class="font-semibold text-slate-800">{{ cand.full_name }}</span>
                <span class="font-semibold text-slate-700">{{ cand.votes }} vote(s)</span>
              </div>
              <div class="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-[var(--hcad-gold)] to-[var(--hcad-navy)] transition-all duration-300"
                  :style="{
                    width: (Math.max(...pos.candidates.map(c => c.votes), 1) ? (cand.votes / Math.max(...pos.candidates.map(c => c.votes), 1)) * 100 : 0) + '%'
                  }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6 border-t border-slate-200 pt-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-semibold">Published results view</h4>
          <button
            class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-emerald-50"
            @click="loadPublishedResults"
          >
            Refresh
          </button>
        </div>
        <div v-if="loadingPublishedResults" class="text-sm text-slate-500">Loading published results...</div>
        <div v-else-if="publishedResults" class="grid gap-3 md:grid-cols-2">
          <div
            v-for="pos in publishedResults.positions || []"
            :key="pos.position_id"
            class="border border-slate-100 rounded-xl p-3 space-y-2"
          >
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold">{{ pos.position }}</p>
              <span class="text-[11px] text-slate-500">{{ pos.candidates?.length || 0 }} candidate(s)</span>
            </div>
            <div class="space-y-2">
              <div v-for="cand in pos.candidates" :key="cand.id" class="flex justify-between text-sm">
                <div>
                  <p class="font-semibold" :class="{ 'text-emerald-700': cand.winner }">{{ cand.full_name }}</p>
                  <p class="text-[11px] text-slate-500">Batch {{ cand.batch_year }} - {{ cand.campus_chapter || 'Campus/Chapter not set' }}</p>
                </div>
                <div class="text-right">
                  <p class="font-semibold text-slate-800">{{ cand.votes }} vote(s)</p>
                  <p v-if="cand.winner" class="text-[11px] text-emerald-700 font-semibold">Winner</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-sm text-slate-600">No published results yet.</div>
      </div>
    </div>

    <div v-if="activeSection === 'timeline'" id="timeline" class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Election timeline</h3>
        <span class="text-[11px] text-slate-500">Nomination & voting windows</span>
      </div>
      <p v-if="electionError" class="text-xs text-rose-600">{{ electionError }}</p>
      <p v-else-if="electionMessage" class="text-xs text-emerald-600">{{ electionMessage }}</p>
      <p v-else-if="!election" class="text-xs text-slate-500">No election configured. Set the dates below and save to create one.</p>
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="font-semibold text-slate-700">Mode:</span>
        <button
          @click="switchMode('timeline')"
          :class="timelineMode === 'timeline' ? 'bg-emerald-600 text-white border border-emerald-600' : 'border border-slate-300 text-slate-700 hover:bg-slate-100'"
          class="px-3 py-1.5 rounded-full"
        >
          Timeline (use dates)
        </button>
        <button
          @click="switchMode('demo')"
          :class="timelineMode === 'demo' ? 'bg-slate-900 text-white border border-slate-900' : 'border border-slate-300 text-slate-700 hover:bg-slate-100'"
          class="px-3 py-1.5 rounded-full"
        >
          Demo (manual phases)
        </button>
        <span class="text-[11px] text-slate-500">
          {{ timelineMode === 'demo' ? 'Demo mode ignores the schedule; use the buttons below to jump phases.' : 'Timeline mode uses the dates you set.' }}
        </span>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="block text-xs font-semibold text-slate-700 mb-1">Election name</label>
          <input v-model="electionForm.name" type="text" placeholder="e.g., 2025 HCAD Alumni Elections" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" :disabled="timelineMode === 'demo'" />
        </div>
        <div class="sm:col-span-2">
          <label class="block text-xs font-semibold text-slate-700 mb-1">Description (optional)</label>
          <textarea v-model="electionForm.description" rows="2" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" :disabled="timelineMode === 'demo'"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Nomination start</label>
          <input v-model="electionForm.nomination_start" type="datetime-local" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" :disabled="timelineMode === 'demo'" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Nomination end</label>
          <input v-model="electionForm.nomination_end" type="datetime-local" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" :disabled="timelineMode === 'demo'" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Voting start</label>
          <input v-model="electionForm.voting_start" type="datetime-local" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" :disabled="timelineMode === 'demo'" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Voting end</label>
          <input v-model="electionForm.voting_end" type="datetime-local" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" :disabled="timelineMode === 'demo'" />
        </div>
        <div class="sm:col-span-2">
          <label class="block text-xs font-semibold text-slate-700 mb-1">Results announcement</label>
          <input v-model="electionForm.results_at" type="datetime-local" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" :disabled="timelineMode === 'demo'" />
        </div>
        <label class="flex items-center gap-2 text-xs text-slate-700">
          <input v-model="electionForm.is_active" type="checkbox" :disabled="timelineMode === 'demo'" />
          Set election as active
        </label>
      </div>
      <div class="flex flex-wrap gap-2 items-center">
        <button
          @click="saveElection"
          :disabled="savingElection || timelineMode === 'demo'"
          class="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm shadow-sm disabled:bg-slate-300"
        >
          {{ savingElection ? 'Saving.' : 'Save timeline' }}
        </button>
        <div class="flex items-center gap-2 text-xs text-slate-600">
          <span v-if="election">Status: {{ election.results_published ? 'Results published' : 'Not published' }}</span>
          <span v-else>No election saved yet.</span>
          <button
            v-if="election"
            @click="publishResults(!election.results_published)"
            :disabled="publishingResults"
            class="px-3 py-1.5 rounded-lg border text-xs"
            :class="election.results_published ? 'border-amber-400 text-amber-700 bg-amber-50' : 'border-emerald-500 text-emerald-700 bg-emerald-50'"
          >
            {{ publishingResults ? 'Updating.' : election.results_published ? 'Unpublish results' : 'Publish results' }}
          </button>
        </div>
      </div>
      <div v-if="timelineMode === 'demo'" class="mt-4 border-t border-slate-200 pt-3 space-y-2">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-semibold">Demo controls</h4>
          <span class="text-[11px] text-slate-500">
            Toggle phases without dates (mode: {{ election?.demo_phase || 'unset' }})
          </span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button @click="triggerDemoPhase('open_nomination')" class="px-3 py-1.5 rounded-lg border text-xs">Open nomination</button>
          <button @click="triggerDemoPhase('close_nomination')" class="px-3 py-1.5 rounded-lg border text-xs">Close nomination</button>
          <button @click="triggerDemoPhase('open_voting')" class="px-3 py-1.5 rounded-lg border text-xs">Open voting</button>
          <button @click="triggerDemoPhase('close_voting')" class="px-3 py-1.5 rounded-lg border text-xs">Close voting</button>
          <button @click="triggerDemoPhase('exit_demo')" class="px-3 py-1.5 rounded-lg border text-xs border-emerald-500 text-emerald-700">
            Return to timeline
          </button>
        </div>
        <p v-if="demoMessage" class="text-[11px] text-emerald-600">{{ demoMessage }}</p>
        <p v-if="demoError" class="text-[11px] text-rose-600">{{ demoError }}</p>
      </div>
      <div v-else class="mt-4 border-t border-slate-200 pt-3">
        <p class="text-[11px] text-slate-500">Demo controls are hidden while in timeline mode.</p>
      </div>
    </div>

    <div v-if="activeSection === 'nominations'" id="nominations" class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Nominations</h3>
        <p class="text-[11px] text-slate-500">Promote to make official candidates.</p>
      </div>
      <div v-if="nominations.length === 0" class="text-xs text-slate-500">No nominations yet.</div>
      <div v-else class="space-y-3">
        <div
          v-for="nom in nominations"
          :key="nom.id"
          class="border border-slate-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        >
          <div>
            <p class="text-sm font-semibold">
              {{ nom.nominee_full_name }} ({{ nom.position_name }})
              <span v-if="nom.promoted" class="text-[11px] text-emerald-600 ml-2">Promoted</span>
            </p>
            <p class="text-[11px] text-slate-500">
              Batch {{ nom.nominee_batch_year }} - {{ nom.nominee_campus_chapter || 'Campus/Chapter not set' }}
            </p>
            <p v-if="nom.promoted_at" class="text-[11px] text-slate-500">Promoted at: {{ nom.promoted_at }}</p>
          </div>
          <button
            v-if="!nom.promoted"
            @click="promote(nom)"
            :disabled="promotingId === nom.id"
            class="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white shadow-sm disabled:bg-slate-300"
          >
            {{ promotingId === nom.id ? 'Promoting.' : 'Promote to Candidate' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="activeSection === 'reminders'" id="reminders" class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
      <h3 class="text-sm font-semibold">Reminders</h3>
      <div v-if="!reminders.length" class="text-xs text-slate-500">No reminders stored.</div>
      <ul v-else class="text-sm text-slate-700 list-disc list-inside">
        <li v-for="rem in reminders" :key="rem.id">{{ rem.remind_at }} - {{ rem.note }}</li>
      </ul>
    </div>

    <div v-if="activeSection === 'voters'" id="voters" class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Voters</h3>
        <div class="flex gap-2">
          <button @click="exportRecentVotersCsv" class="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100">Export recent CSV</button>
          <button @click="openAddVoter" class="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white shadow-sm">Add voter</button>
          <button
            @click="resetAllVoters"
            :disabled="resettingVoters"
            class="text-xs px-3 py-1.5 rounded-lg border border-amber-400 text-amber-700 bg-amber-50"
          >
            {{ resettingVoters ? 'Resetting.' : 'Reset voters' }}
          </button>
        </div>
      </div>
      <label class="flex items-center gap-2 text-[11px] text-slate-600">
        <input type="checkbox" v-model="resetPins" />
        Also reset PINs
      </label>
      <div v-if="loadingVoters" class="text-xs text-slate-500">Loading voters.</div>
      <div v-else class="text-xs text-slate-600">Total: {{ voters.length }}</div>
      <div v-if="recentVoters.length" class="border border-slate-100 rounded-xl p-3 bg-slate-50 text-[11px] space-y-2">
        <div class="flex items-center justify-between">
          <p class="font-semibold text-slate-800">Recent credentials (last 30 min)</p>
          <button @click="pruneRecentVoters" class="px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 text-[10px]">Refresh</button>
        </div>
        <div class="max-h-40 overflow-y-auto divide-y divide-slate-200">
          <div v-for="rv in recentVoters" :key="rv.voter_id + rv.pin" class="py-2">
            <p class="font-semibold text-slate-800">{{ rv.name }} <span class="text-slate-500">({{ rv.voter_id }})</span></p>
            <p class="text-slate-700">PIN: {{ rv.pin }}</p>
            <p class="text-slate-500 text-[10px]">{{ rv.source }} · {{ new Date(rv.createdAt).toLocaleString() }}</p>
          </div>
        </div>
      </div>
      <div class="max-h-64 overflow-y-auto border border-slate-100 rounded-xl" v-if="voters.length">
        <table class="w-full text-xs">
          <thead class="bg-slate-50">
            <tr class="text-left text-slate-500">
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Voter ID</th>
              <th class="px-3 py-2">Batch</th>
              <th class="px-3 py-2">Voted</th>
              <th class="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in voters" :key="v.id" class="border-t border-slate-100">
              <td class="px-3 py-2">{{ v.name }}</td>
              <td class="px-3 py-2">{{ v.voter_id }}</td>
              <td class="px-3 py-2">{{ v.batch_year || 'N/A' }}</td>
              <td class="px-3 py-2">{{ v.has_voted ? 'Yes' : 'No' }}</td>
              <td class="px-3 py-2 text-right">
                <button @click="resetVoterPin(v)" class="text-[10px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-100">Reset PIN</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="voterError" class="text-xs text-rose-600">{{ voterError }}</p>
    </div>

    <div v-if="addVoterModal" class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-3">
      <div class="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">Add voter</h3>
          <button class="text-xs" @click="addVoterModal = false">?</button>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="text-[11px] font-semibold text-slate-700">Full name</label>
            <input v-model="newVoter.name" type="text" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="text-[11px] font-semibold text-slate-700">Batch year</label>
            <input v-model="newVoter.batch_year" type="number" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="text-[11px] font-semibold text-slate-700">Campus/Chapter</label>
            <input
              v-model="newVoter.campus_chapter"
              type="text"
              readonly
              class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600"
            />
            <p class="text-[10px] text-slate-500">Fixed to Digos City for this alumni chapter.</p>
          </div>
          <div>
            <label class="text-[11px] font-semibold text-slate-700">Email</label>
            <input v-model="newVoter.email" type="email" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="text-[11px] font-semibold text-slate-700">Phone</label>
            <input v-model="newVoter.phone" type="text" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="text-[11px] font-semibold text-slate-700">PIN (optional)</label>
            <input v-model="newVoter.pin" type="text" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <p class="text-[10px] text-slate-500">Leave blank to auto-generate.</p>
          </div>
          <label class="flex items-center gap-2 text-[11px] text-slate-700 sm:col-span-2">
            <input type="checkbox" v-model="newVoter.privacy_consent" />
            Mark privacy consent as granted
          </label>
        </div>
        <p v-if="voterError" class="text-xs text-rose-600">{{ voterError }}</p>
        <div class="flex justify-end gap-2 pt-2">
          <button class="text-xs px-3 py-1.5 rounded-lg border border-slate-300" @click="addVoterModal = false">Cancel</button>
          <button
            @click="submitVoter"
            :disabled="voterSubmitting"
            class="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white shadow-sm disabled:bg-slate-300"
          >
            {{ voterSubmitting ? 'Saving.' : 'Save voter' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
