<!-- src/views/ResultsView.vue -->
<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import api from '../api'
import { countdownTo, formatDateTime, toMs } from '../utils/time'

const results = ref(null)
const election = ref(null)
const loading = ref(true)
const error = ref('')
const now = ref(Date.now())
const candidatePlaceholder =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' rx='40' fill='%23dfe4ea'/><path d='M40 40a12 12 0 1 0-0.001-24.001A12 12 0 0 0 40 40zm0 8c-11.046 0-20 6.268-20 14v4h40v-4c0-7.732-8.954-14-20-14z' fill='%2390a4ae'/></svg>"

const hasActiveElection = computed(() => !!election.value && election.value.is_active)
const hasTimeline = computed(() => {
  const e = election.value
  if (!e) return false
  const required = [e.nomination_start, e.nomination_end, e.voting_start, e.voting_end]
  return required.every((v) => {
    const ts = toMs(v)
    return ts !== null && !Number.isNaN(ts)
  })
})

const resultsCountdown = computed(() => {
  if (!hasTimeline.value || !election.value?.results_at) return null
  const target = toMs(election.value.results_at)
  if (!target) return null
  return countdownTo(target, now.value)
})

const resultsEta = computed(() => {
  if (!hasTimeline.value || !election.value?.results_at) return null
  return formatDateTime(election.value.results_at)
})

const winnersSummary = computed(() => {
  if (!results.value?.positions?.length) return []
  return results.value.positions
    .map((pos) => {
      const maxVotes = Math.max(...(pos.candidates || []).map((c) => c.votes || 0), 0)
      const winner = (pos.candidates || []).find((c) => c.winner) || (pos.candidates || []).find((c) => (c.votes || 0) === maxVotes)
      if (!winner) return null
      return {
        position_id: pos.position_id,
        position: pos.position,
        candidate: winner,
        votes: winner.votes || 0,
      }
    })
    .filter(Boolean)
})

const activePositionId = ref(null)
const activePosition = computed(() => {
  return results.value?.positions?.find((p) => p.position_id === activePositionId.value) || null
})

watch(
  () => results.value?.positions,
  (list) => {
    if (!list || list.length === 0) {
      activePositionId.value = null
      return
    }
    const exists = list.some((p) => p.position_id === activePositionId.value)
    activePositionId.value = exists ? activePositionId.value : list[0].position_id
  },
  { immediate: true },
)

const loadResults = async (opts = {}) => {
  const silent = opts.silent
  if (!silent) loading.value = true
  try {
    const res = await api.get('elections/results/')
    if (res.data?.published) {
      results.value = res.data
    } else {
      results.value = null
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to load results.'
  } finally {
    if (!silent) loading.value = false
  }
}

const loadElection = async () => {
  try {
    const res = await api.get('elections/current/')
    election.value = res.data?.election || null
  } catch (err) {
    election.value = null
  }
}

let timerId
let refreshing = false
let publishTimer = null

const clearPublishTimer = () => {
  if (publishTimer) {
    clearTimeout(publishTimer)
    publishTimer = null
  }
}

const schedulePublishCheck = () => {
  clearPublishTimer()
  const target = toMs(election.value?.results_at)
  if (!target) return
  const msUntil = target - Date.now()
  if (msUntil <= 0) {
    loadResults({ silent: false })
    return
  }
  publishTimer = setTimeout(async () => {
    await loadResults({ silent: false })
    await loadElection()
    schedulePublishCheck()
  }, Math.min(msUntil + 1000, 6 * 60 * 60 * 1000))
}

const tick = async () => {
  now.value = Date.now()
  if (refreshing) return
  refreshing = true
  try {
    await Promise.all([loadResults({ silent: true }), loadElection()])
  } catch (e) {
    // ignore transient refresh errors
  } finally {
    refreshing = false
  }
  schedulePublishCheck()
}

onMounted(async () => {
  await Promise.all([loadResults(), loadElection()])
  schedulePublishCheck()
  timerId = setInterval(tick, 15000)
})

onUnmounted(() => {
  if (timerId) clearInterval(timerId)
  clearPublishTimer()
})
</script>

<template>
  <div class="space-y-4">
    <div class="bg-white/90 rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="space-y-1">
          <p class="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Results</p>
          <h2 class="text-lg font-semibold">{{ results?.demo ? 'Demo results' : 'Official results' }}</h2>
          <p class="text-xs text-slate-500">
            <span v-if="results">Published {{ formatDateTime(results?.published_at) }}</span>
            <span v-else-if="loading">Checking publication status...</span>
            <span v-else>Results will appear here once COMELEC publishes them.</span>
          </p>
          <p v-if="!results && resultsEta" class="text-[11px] text-amber-700 mt-1">
            Expected at {{ resultsEta }}
            <span v-if="resultsCountdown">(in {{ resultsCountdown.text }})</span>
          </p>
          <p v-if="results?.demo" class="text-[11px] text-amber-700 mt-1">Demo mode: not official.</p>
        </div>
        <button
          class="px-3 py-1.5 rounded-lg text-xs border border-slate-200 hover:bg-emerald-50 self-start sm:self-auto"
          @click="loadResults"
        >
          Refresh
        </button>
      </div>
    </div>

    <div v-if="error" class="text-sm text-rose-600">{{ error }}</div>
    <div v-else-if="loading" class="text-sm text-slate-600">Loading...</div>

    <div v-else-if="results" class="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="pos in results.positions || []"
            :key="pos.position_id"
            class="px-3 py-1.5 rounded-full border text-xs transition"
            :class="
              activePositionId === pos.position_id
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'border-slate-300 bg-white hover:bg-emerald-50 text-slate-700'
            "
            @click="activePositionId = pos.position_id"
          >
            {{ pos.position }}
          </button>
        </div>

        <div
          v-if="activePosition"
          class="bg-white/90 rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3"
        >
          <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 class="text-sm font-semibold text-slate-800">{{ activePosition.position }}</h3>
            <span class="text-[11px] text-slate-500">{{ activePosition.candidates?.length || 0 }} candidate(s)</span>
          </div>
          <ul class="space-y-3 text-sm text-slate-700">
            <li
              v-for="cand in activePosition.candidates"
              :key="cand.id"
              class="space-y-1"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="h-10 w-10 rounded-full border border-slate-200 bg-white overflow-hidden flex-shrink-0">
                    <img :src="cand.photo_url || candidatePlaceholder" alt="Candidate photo" class="h-full w-full object-cover" />
                  </div>
                  <div class="min-w-0">
                    <p class="font-semibold truncate" :class="{ 'text-[var(--hcad-navy)]': cand.winner }">{{ cand.full_name }}</p>
                    <p class="text-[11px] text-slate-500">
                      Batch {{ cand.batch_year }} - {{ cand.campus_chapter || 'Campus/Chapter not set' }}
                    </p>
                  </div>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="text-sm font-semibold text-slate-800">{{ cand.votes }} vote(s)</p>
                  <p v-if="cand.winner" class="text-[11px] text-[var(--hcad-navy)] font-semibold">Winner</p>
                </div>
              </div>
              <div class="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-[var(--hcad-gold)] to-[var(--hcad-navy)] transition-all duration-300"
                  :style="{
                    width:
                      (Math.max(...activePosition.candidates.map((c) => c.votes), 1)
                        ? (cand.votes / Math.max(...activePosition.candidates.map((c) => c.votes), 1)) * 100
                        : 0) + '%',
                  }"
                ></div>
              </div>
            </li>
          </ul>
        </div>
        <p v-else class="text-sm text-slate-600">No positions to display.</p>
      </div>

      <div v-if="winnersSummary.length" class="space-y-3">
        <div class="bg-white/90 rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-slate-800">Election Results Summary</h3>
            <span class="text-[11px] text-slate-500">Top candidate per position</span>
          </div>
          <div class="grid gap-3 max-h-[70vh] overflow-y-auto pr-1">
            <div
              v-for="item in winnersSummary"
              :key="item.position_id"
              class="border border-slate-200 rounded-2xl bg-[#f7f8fa] p-3 flex gap-3 items-center shadow-sm"
            >
              <div class="h-16 w-16 rounded-xl overflow-hidden border border-slate-200 bg-white flex-shrink-0">
                <img :src="item.candidate.photo_url || candidatePlaceholder" alt="Winner photo" class="h-full w-full object-cover" />
              </div>
              <div class="flex-1 min-w-0 space-y-1">
                <p class="text-xs font-semibold text-slate-700 uppercase">{{ item.position }}</p>
                <p class="text-base font-semibold text-slate-900 truncate">{{ item.candidate.full_name }}</p>
                <p class="text-[12px] text-slate-500 truncate">
                  Batch {{ item.candidate.batch_year || 'N/A' }}
                  <span v-if="item.candidate.campus_chapter"> · {{ item.candidate.campus_chapter }}</span>
                </p>
                <p class="text-sm font-semibold text-[var(--hcad-navy)]">{{ item.votes }} vote(s)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-sm text-slate-600">Results not yet published.</div>
  </div>
</template>
