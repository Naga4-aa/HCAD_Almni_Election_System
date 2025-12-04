<!-- src/views/LandingView.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue'
import { RouterLink } from 'vue-router'
import api from '../api'

const election = ref(null)
const results = ref(null)
const loading = ref(true)
const resultsLoading = ref(true)

const formatDate = (value) => {
  if (!value) return 'TBD'
  try {
    return new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
  } catch (e) {
    return value
  }
}

const formatRange = (start, end) => {
  if (!start || !end) return 'To be announced'
  return `${formatDate(start)} → ${formatDate(end)}`
}

const loadElection = async () => {
  try {
    const res = await api.get('elections/current/')
    election.value = res.data?.election || null
  } catch (err) {
    election.value = null
  } finally {
    loading.value = false
  }
}

const loadResults = async () => {
  try {
    const res = await api.get('elections/results/')
    results.value = res.data || null
  } catch (err) {
    results.value = null
  } finally {
    resultsLoading.value = false
  }
}

const hasPublishedResults = computed(() => results.value?.published)

onMounted(async () => {
  await Promise.all([loadElection(), loadResults()])
})
</script>

<template>
  <div class="space-y-8">
    <section class="bg-gradient-to-r from-[var(--hcad-gold)] to-[var(--hcad-navy)] text-white rounded-3xl p-6 sm:p-10 shadow-xl">
      <p class="text-xs uppercase tracking-wide text-emerald-100">HCAD Alumni Association, Inc.</p>
      <h1 class="text-2xl sm:text-3xl font-semibold mt-2">HCAD Alumni Election System</h1>
      <p class="mt-3 max-w-3xl text-sm sm:text-base text-emerald-50">
        Nominate and vote for the HCADAA FYs 2025-2027 Officers.
      </p>
      <div class="mt-6 flex flex-wrap gap-3 text-sm">
        <RouterLink
          to="/login"
          class="px-4 py-2 rounded-lg bg-white text-emerald-700 font-semibold shadow-sm transition-all duration-150 hover:bg-emerald-50 hover:shadow-[0_6px_14px_rgba(0,0,0,0.15)] hover:-translate-y-[1px]"
          >Voter Login</RouterLink
        >
        <RouterLink
          to="/info"
          class="px-4 py-2 rounded-lg border border-emerald-200/70 bg-emerald-50/30 text-white transition-all duration-150 shadow-[0_2px_10px_rgba(0,0,0,0.08)] hover:bg-white/20 hover:border-white/70 hover:shadow-[0_6px_14px_rgba(0,0,0,0.15)] hover:text-white"
          >Registration Instructions</RouterLink
        >
      </div>
    </section>

    <section class="grid gap-4 md:grid-cols-3">
      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <h3 class="text-sm font-semibold text-slate-800">Nomination Period</h3>
        <p class="text-xs text-slate-500">
          <span v-if="election">{{ formatRange(election.nomination_start, election.nomination_end) }}</span>
          <span v-else>To be announced</span>
        </p>
        <p class="text-xs text-slate-600 mt-2">Submit one nominee for any open position.</p>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <h3 class="text-sm font-semibold text-slate-800">Voting Period</h3>
        <p class="text-xs text-slate-500">
          <span v-if="election">{{ formatRange(election.voting_start, election.voting_end) }}</span>
          <span v-else>To be announced</span>
        </p>
        <p class="text-xs text-slate-600 mt-2">One ballot per voter. One vote per position.</p>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <h3 class="text-sm font-semibold text-slate-800">Results</h3>
        <p class="text-xs text-slate-500">
          <span v-if="election?.results_at">{{ formatDate(election.results_at) }}</span>
          <span v-else>To be announced</span>
        </p>
        <p class="text-xs text-slate-600 mt-2">
          <span v-if="hasPublishedResults">Published to all voters.</span>
          <span v-else>Will be shown here once officially published.</span>
        </p>
      </div>
    </section>

    <section class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3 text-sm text-slate-700">
      <h2 class="text-lg font-semibold text-slate-900">How to participate</h2>
      <ol class="list-decimal list-inside space-y-2">
        <li>Use quick entry: enter your full name and batch/year, and check the consent box to proceed.</li>
        <li>Optional: add campus/chapter and contact details so admins can verify you if needed.</li>
        <li>
          During
          <strong>{{ election ? formatRange(election.nomination_start, election.nomination_end) : 'the nomination window' }}</strong>:
          submit one nomination (with reason and contact details).
        </li>
        <li>
          During
          <strong>{{ election ? formatRange(election.voting_start, election.voting_end) : 'the voting window' }}</strong>:
          select one candidate per position and submit your ballot once.
        </li>
      </ol>
      <p class="text-[11px] text-slate-500">Need help? Contact the HCAD Alumni office or your chapter lead.</p>
    </section>

    <section
      class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4"
      aria-label="Published results"
    >
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Results</p>
          <h3 class="text-lg font-semibold">Official tallies</h3>
          <p class="text-xs text-slate-500">
            <span v-if="hasPublishedResults">
              Published {{ formatDate(results?.published_at) }}
            </span>
            <span v-else>Results will appear after COMELEC publishes them.</span>
          </p>
        </div>
        <div class="text-xs text-slate-600" v-if="resultsLoading">Loading results...</div>
      </div>

      <div v-if="hasPublishedResults" class="grid gap-4 md:grid-cols-2">
        <div
          v-for="pos in results?.positions || []"
          :key="pos.position_id"
          class="border rounded-xl p-4 shadow-sm"
        >
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-semibold text-slate-800">{{ pos.position }}</h4>
            <span class="text-[11px] text-emerald-700 font-semibold">Published</span>
          </div>
          <ul class="space-y-3 text-sm text-slate-700">
            <li
              v-for="cand in pos.candidates"
              :key="cand.id"
              class="space-y-1"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-semibold" :class="{ 'text-emerald-700': cand.winner }">
                    {{ cand.full_name }}
                  </p>
                  <p class="text-[11px] text-slate-500">
                    Batch {{ cand.batch_year }} - {{ cand.campus_chapter || 'Campus/Chapter not set' }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-semibold text-slate-800">{{ cand.votes }} vote(s)</p>
                  <p v-if="cand.winner" class="text-[11px] text-emerald-700 font-semibold">Winner</p>
                </div>
              </div>
              <div class="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-[var(--hcad-gold)] to-[var(--hcad-navy)] transition-all duration-300"
                  :style="{
                    width: (Math.max(...pos.candidates.map(c => c.votes), 1) ? (cand.votes / Math.max(...pos.candidates.map(c => c.votes), 1)) * 100 : 0) + '%'
                  }"
                ></div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>
