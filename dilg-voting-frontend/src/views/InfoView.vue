<!-- src/views/InfoView.vue -->
<template>
  <div class="space-y-4">
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 class="text-xl font-semibold text-slate-900">Registration instructions</h2>
      <p class="text-sm text-slate-600 mt-2">
        Alumni must be verified by an admin before logging in. Please provide your full name,
        batch/year, campus/chapter, and contact number/email to the HCAD Alumni office or chapter
        coordinator. They will generate your Voter ID and PIN.
      </p>
      <ul class="text-sm text-slate-700 list-disc list-inside mt-3 space-y-1">
        <li>You will receive a Voter ID (e.g., HCAD-0001) and a PIN (6 digits).</li>
        <li>Keep them private. You can log in once the admin marks you as active.</li>
        <li>You must check the consent box: “I agree to the processing of my personal data for the purpose of elections.”</li>
      </ul>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-2 text-sm text-slate-700">
      <h3 class="text-lg font-semibold text-slate-900">Key rules</h3>
      <ul class="list-disc list-inside space-y-1">
        <li>Nomination period: Dec 1–15, 2025 (one nomination per voter).</li>
        <li>Voting period: Dec 16–20, 2025 (one vote per position, one ballot submission).</li>
        <li>Eligible voters: all verified alumni (no pre-loaded roster).</li>
        <li>Nominee data: name, position, batch/year, campus/chapter, contact, reason, photo.</li>
        <li>Results are visible to admins/Comelec only during voting; official on Dec 21.</li>
      </ul>
    </div>
  </div>
</template>
