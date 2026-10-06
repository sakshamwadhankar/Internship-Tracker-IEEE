// One-off probe: run the real Indian-board adapters against the live sites
// and report parsed counts. Run: node scratch/probe-sources.mjs
const ids = ['internshala', 'naukri', 'unstop', 'instahyre', 'letintern', 'cutshort'];

for (const id of ids) {
  const mod = await import(`../functions/src/sources/${id}.js`);
  const adapter = mod.default;
  try {
    const jobs = await adapter.fetchJobs({});
    const sample = jobs[0] ? `${jobs[0].title.slice(0, 40)} @ ${jobs[0].company}` : '—';
    console.log(`${id.padEnd(12)} ${String(jobs.length).padStart(3)} jobs   ${sample}`);
  } catch (e) {
    console.log(`${id.padEnd(12)} ERROR   ${String(e.message).slice(0, 90)}`);
  }
}
