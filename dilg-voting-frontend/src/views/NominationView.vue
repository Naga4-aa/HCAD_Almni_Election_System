<!-- src/views/NominationView.vue -->
<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import api from '../api'
import { useAuthStore } from '../stores/auth'
import { countdownTo, formatDateTime, toMs } from '../utils/time'

const authStore = useAuthStore()

const election = ref(null)
const positions = ref([])
const now = ref(Date.now())
const form = ref({
  position_id: null,
  nominee_full_name: '',
  nominee_batch_year: '',
  nominee_campus_chapter: '',
  contact_email: '',
  contact_phone: '',
  reason: '',
  nominee_photo: null,
  is_good_standing: false,
  consent: false,
})
const myNomination = ref(null)
const candidatesByPosition = ref({})
const candidatesLoading = ref(false)
const candidatesError = ref('')
const statusMessage = ref('')
const errorMessage = ref('')
const loading = ref(false)
const submitting = ref(false)
const lastElectionId = ref(null)

const isDemoMode = computed(() => election.value?.mode === 'demo')
const isNominationOpen = computed(() => {
  if (isDemoMode.value && election.value?.demo_phase) {
    return election.value.demo_phase === 'nomination'
  }
  return election.value?.phase === 'nomination'
})
const hasActiveElection = computed(() => !!election.value && election.value.is_active)
const hasTimeline = computed(() => {
  const e = election.value
  if (isDemoMode.value) return true
  if (!e || !e.is_active) return false
  const required = [e.nomination_start, e.nomination_end, e.voting_start, e.voting_end]
  return required.every((v) => {
    const ts = toMs(v)
    return ts !== null && !Number.isNaN(ts)
  })
})
const showNominationForm = computed(() => hasActiveElection.value && hasTimeline.value && isNominationOpen.value)

const nominationTiming = computed(() => {
  if (isDemoMode.value) {
    return {
      label: 'Demo mode',
      countdown: null,
      detail: `Phase: ${election.value?.demo_phase || 'unset'}`,
      tone: 'info',
    }
  }
  if (!hasActiveElection.value || !hasTimeline.value) return null
  const start = toMs(election.value.nomination_start)
  const end = toMs(election.value.nomination_end)
  const current = now.value
  if (start && current < start) {
    return {
      label: 'Nomination starts in',
      countdown: countdownTo(start, current),
      detail: formatDateTime(election.value.nomination_start),
      tone: 'info',
    }
  }
  if (end && current <= end) {
    return {
      label: 'Nomination ends in',
      countdown: countdownTo(end, current),
      detail: formatDateTime(election.value.nomination_end),
      tone: 'success',
    }
  }
  if (end) {
    return {
      label: 'Nomination closed',
      countdown: null,
      detail: formatDateTime(election.value.nomination_end),
      tone: 'muted',
    }
  }
  return null
})

const resetNotice = computed(() => {
  if (!election.value) return 'No active election. Waiting for admin to open nominations.'
  if (isDemoMode.value) return 'Demo mode active. Phases are controlled manually by the admin.'
  if (!election.value.is_active) return 'Election timeline reset. Please check back once admin reactivates.'
  if (!hasTimeline.value) return 'Timeline not set. Waiting for admin to provide dates.'
  return ''
})

const displayPhase = computed(() => {
  if (!election.value) return 'N/A'
  if (isDemoMode.value) return election.value.demo_phase || 'demo'
  return election.value.phase || 'N/A'
})

const loadElection = async () => {
  try {
    const res = await api.get('elections/current/')
    election.value = res.data?.election || null
  } catch (err) {
    console.error(err)
    election.value = null
  }
}

const loadPositions = async () => {
  try {
    const res = await api.get('positions/')
    positions.value = res.data || []
  } catch (err) {
    console.error(err)
  }
}

const loadCandidates = async () => {
  if (!positions.value.length) {
    candidatesByPosition.value = {}
    return
  }

  candidatesLoading.value = true
  candidatesError.value = ''

  try {
    const entries = await Promise.all(
      positions.value.map(async (p) => {
        const res = await api.get('candidates/', { params: { position: p.id } })
        return [p.id, res.data || []]
      }),
    )
    const map = {}
    entries.forEach(([id, items]) => {
      map[id] = items
    })
    candidatesByPosition.value = map
  } catch (err) {
    console.error(err)
    candidatesError.value = 'Failed to load candidate list.'
    candidatesByPosition.value = {}
  } finally {
    candidatesLoading.value = false
  }
}

const loadMyNomination = async () => {
  try {
    const res = await api.get('my-nomination/')
    if (res.data && res.data.id) {
      myNomination.value = res.data
    }
  } catch (err) {
    myNomination.value = null
  }
}

const handleFile = (e) => {
  const file = e.target.files?.[0]
  form.value.nominee_photo = file || null
}

const submitNomination = async () => {
  if (!form.value.consent) {
    errorMessage.value = 'Please agree to the data processing consent.'
    return
  }
  if (!isNominationOpen.value) {
    errorMessage.value = 'Nomination period is closed.'
    return
  }

  submitting.value = true
  errorMessage.value = ''
  statusMessage.value = ''

  try {
    const payload = new FormData()
    payload.append('position_id', form.value.position_id)
    payload.append('nominee_full_name', form.value.nominee_full_name)
    payload.append('nominee_batch_year', form.value.nominee_batch_year)
    payload.append('nominee_campus_chapter', form.value.nominee_campus_chapter)
    payload.append('contact_email', form.value.contact_email)
    payload.append('contact_phone', form.value.contact_phone)
    payload.append('reason', form.value.reason)
    payload.append('is_good_standing', form.value.is_good_standing ? 'true' : 'false')
    if (form.value.nominee_photo) {
      payload.append('nominee_photo', form.value.nominee_photo)
    }

    const res = await api.post('nominate/', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    myNomination.value = res.data
    statusMessage.value = 'Nomination submitted successfully.'
  } catch (err) {
    console.error(err)
    errorMessage.value = err.response?.data?.error || 'Failed to submit nomination.'
  } finally {
    submitting.value = false
  }
}

let timerId
let refreshing = false

const tick = async () => {
  now.value = Date.now()
  if (refreshing) return
  refreshing = true
  try {
    await loadElection()
    const currentId = election.value?.id || null
    const active = !!election.value?.is_active
    const timelineReady = hasTimeline.value
    if (!active || !currentId || !timelineReady) {
      positions.value = []
      myNomination.value = null
      candidatesByPosition.value = {}
      lastElectionId.value = null
      return
    }
    if (lastElectionId.value !== currentId) {
      lastElectionId.value = currentId
      await loadPositions()
      await loadMyNomination()
    }
    await loadCandidates()
  } catch (e) {
    // ignore transient errors
  } finally {
    refreshing = false
  }
}

onMounted(async () => {
  loading.value = true
  await Promise.all([loadElection(), loadPositions(), loadMyNomination()])
  if (!election.value?.is_active || !hasTimeline.value) {
    positions.value = []
    myNomination.value = null
    lastElectionId.value = null
    candidatesByPosition.value = {}
  } else {
    lastElectionId.value = election.value?.id || null
    await loadCandidates()
  }
  loading.value = false
  timerId = setInterval(tick, 15000)
})

onUnmounted(() => {
  if (timerId) clearInterval(timerId)
})
</script>

<template>
  <div class="space-y-4">
    <div class="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col gap-3">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div class="space-y-1">
          <p class="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Nomination</p>
          <h2 class="text-lg font-semibold leading-tight">Submit your nominee</h2>
          <p class="text-xs text-slate-500">One nomination per voter for this election.</p>
        </div>
        <div class="text-xs text-slate-600 space-y-0.5 sm:text-right">
          <p class="font-semibold">Phase: {{ hasTimeline ? displayPhase : 'N/A' }}</p>
          <p v-if="resetNotice" class="text-amber-700">{{ resetNotice }}</p>
          <p v-else-if="nominationTiming?.countdown" :class="nominationTiming?.tone === 'success' ? 'text-emerald-700' : 'text-amber-700'">
            {{ nominationTiming.label }} <span class="font-semibold">{{ nominationTiming.countdown.text }}</span>
          </p>
          <p v-else-if="nominationTiming?.detail" class="text-amber-700">
            {{ nominationTiming.label }} ({{ nominationTiming.detail }})
          </p>
          <p v-else-if="!isNominationOpen" class="text-amber-700">Nomination window closed</p>
        </div>
      </div>

      <div class="rounded-2xl bg-gradient-to-br from-emerald-50 via-slate-50 to-white border border-emerald-100 shadow-inner p-3 sm:p-4 space-y-3">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-1 border border-emerald-200">
              Current candidates
            </span>
            <p class="text-[11px] text-slate-600">Official nominees already in the tally, by position.</p>
          </div>
          <button
            @click="loadCandidates"
            :disabled="candidatesLoading"
            class="self-start text-xs px-3 py-1.5 rounded-lg border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 disabled:opacity-60 shadow-sm"
          >
            {{ candidatesLoading ? 'Refreshing...' : 'Refresh list' }}
          </button>
        </div>
        <p v-if="candidatesError" class="text-xs text-rose-600">{{ candidatesError }}</p>
        <p v-else-if="candidatesLoading" class="text-xs text-slate-600">Loading candidate list...</p>
        <div v-else class="grid gap-3 md:grid-cols-2">
          <div
            v-for="p in positions"
            :key="p.id"
            class="rounded-xl border border-emerald-100 bg-white/90 p-3 space-y-2 shadow-sm"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-sm font-semibold text-slate-800">{{ p.name_display || p.name }}</p>
                <p class="text-[11px] text-slate-500">
                  {{ (candidatesByPosition[p.id] || []).length }} candidate(s)
                </p>
              </div>
            </div>
            <div v-if="(candidatesByPosition[p.id] || []).length" class="space-y-2">
              <div
                v-for="cand in candidatesByPosition[p.id]"
                :key="cand.id"
                class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p class="text-sm font-semibold text-slate-800">{{ cand.full_name }}</p>
                <p class="text-[11px] text-slate-500">
                  Batch {{ cand.batch_year || 'N/A' }} - {{ cand.campus_chapter || 'Chapter not set' }}
                </p>
              </div>
            </div>
            <p v-else class="text-[11px] text-slate-500">No official candidates yet for this position.</p>
          </div>
        </div>
      </div>

      <p v-if="myNomination" class="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
        You already nominated <span class="font-semibold">{{ myNomination.nominee_full_name }}</span>
        for {{ myNomination.position_name }}. Thank you!
      </p>

      <div v-else-if="!hasActiveElection" class="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
        No active election. Please wait for the admin to reopen nominations.
      </div>

      <div v-else-if="!hasTimeline" class="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
        Timeline not set. Waiting for admin to provide dates.
      </div>

      <div v-else-if="showNominationForm" class="grid gap-3 md:grid-cols-2 border border-slate-200 rounded-2xl p-3 sm:p-4 bg-white/90">
        <div class="space-y-3">
          <div>
            <label class="text-xs font-semibold text-slate-700">Position</label>
            <select
              v-model="form.position_id"
              class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              :disabled="!isNominationOpen"
            >
              <option value="">-- Select position --</option>
              <option v-for="p in positions" :key="p.id" :value="p.id">{{ p.name_display || p.name }}</option>
            </select>
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-700">Nominee full name</label>
            <input
              v-model="form.nominee_full_name"
              type="text"
              class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Juan Dela Cruz"
              :disabled="!isNominationOpen"
            />
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="text-xs font-semibold text-slate-700">Batch / Year</label>
              <input
                v-model="form.nominee_batch_year"
                type="number"
                class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="1998"
                :disabled="!isNominationOpen"
              />
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-700">Campus / Chapter</label>
              <input
                v-model="form.nominee_campus_chapter"
                type="text"
                class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Main Campus / Digos / etc"
                :disabled="!isNominationOpen"
              />
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="text-xs font-semibold text-slate-700">Contact Email (optional)</label>
              <input
                v-model="form.contact_email"
                type="email"
                class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="name@email.com"
                :disabled="!isNominationOpen"
              />
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-700">Contact Phone (optional)</label>
              <input
                v-model="form.contact_phone"
                type="text"
                class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="09xxxxxxxxx"
                :disabled="!isNominationOpen"
              />
            </div>
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-700">Reason for nomination</label>
            <textarea
              v-model="form.reason"
              rows="4"
              class="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Why are you nominating this alumnus/a?"
              :disabled="!isNominationOpen"
            ></textarea>
          </div>

          <div class="flex items-center gap-2 text-xs">
            <input type="checkbox" v-model="form.is_good_standing" :disabled="!isNominationOpen" />
            <span>Nominee is in good standing (checked by admin if applicable)</span>
          </div>
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-xs font-semibold text-slate-700">Nominee photo (optional)</label>
            <input type="file" accept="image/*" @change="handleFile" :disabled="!isNominationOpen" />
          </div>

          <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
            <p class="font-semibold text-slate-800 mb-2">Consent</p>
            <label class="flex items-start gap-2">
              <input type="checkbox" v-model="form.consent" />
              <span>I agree to the processing of my personal data for the purpose of elections.</span>
            </label>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              @click="submitNomination"
              :disabled="submitting || !isNominationOpen"
              class="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm shadow-sm disabled:bg-slate-300"
            >
              {{ submitting ? 'Submitting.' : 'Submit Nomination' }}
            </button>
          </div>

          <p v-if="statusMessage" class="text-sm text-emerald-700">{{ statusMessage }}</p>
          <p v-if="errorMessage" class="text-sm text-rose-600">{{ errorMessage }}</p>
        </div>
      </div>

      <div v-else class="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
        Nomination window not open. Please check the posted schedule.
      </div>
    </div>
  </div>
</template>
