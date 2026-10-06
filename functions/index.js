/**
 * PTracker opportunity scraper — Cloud Functions entrypoint.
 *
 *  - scheduledSync: every 6 hours, pull all enabled sources into Firestore
 *  - syncNow:       authenticated callable for the "Sync now" button
 *
 * Required secrets (free tiers):
 *   firebase functions:secrets:set ADZUNA_APP_ID
 *   firebase functions:secrets:set ADZUNA_APP_KEY
 *   firebase functions:secrets:set JOOBLE_API_KEY
 *   firebase functions:secrets:set CAREERJET_AFFID
 * Sources without their key are skipped gracefully and noted in sync_meta.
 */

import { setGlobalOptions } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { runSync } from './src/sync.js';

// Platform-default credentials inside the Cloud Functions runtime.
initializeApp();

setGlobalOptions({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 540,
});

const SECRETS = [
  defineSecret('ADZUNA_APP_ID'),
  defineSecret('ADZUNA_APP_KEY'),
  defineSecret('JOOBLE_API_KEY'),
  defineSecret('CAREERJET_AFFID'),
];

export const scheduledSync = onSchedule(
  {
    schedule: '0 */6 * * *',
    secrets: SECRETS,
  },
  async () => {
    const results = await runSync();
    console.log(`[sync] scheduled run complete: ${JSON.stringify(results)}`);
  }
);

export const syncNow = onCall({ secrets: SECRETS }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to trigger a sync.');
  }
  // Optional: restrict to specific sources via data.sourceIds
  const sourceIds = Array.isArray(request.data?.sourceIds) ? request.data.sourceIds : null;
  const results = await runSync(sourceIds);
  return { results };
});
