// One-off probe: deep-dive each failing source. Run: node scratch/probe-detail.mjs
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function probe(name, url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
    const text = await res.text();
    console.log(`\n=== ${name}: ${res.status}, ${text.length} bytes ===`);
    return text;
  } catch (e) {
    console.log(`\n=== ${name}: FETCH FAILED ===`);
    console.log('message:', e.message, '| cause:', e.cause?.code || e.cause?.message || e.cause);
    return null;
  }
}

const internshala = await probe('internshala', 'https://internshala.com/internships/');
if (internshala) {
  console.log('has individual_internship:', internshala.includes('individual_internship'));
  console.log('has internship detail links:', (internshala.match(/\/internship\/detail\//g) || []).length);
  console.log('cloudflare challenge:', internshala.includes('cf-challenge') || internshala.includes('Just a moment'));
}

const naukri = await probe('naukri', 'https://www.naukri.com/internship-jobs');
if (naukri) {
  console.log('has __PRELOADED_STATE__:', naukri.includes('__PRELOADED_STATE__'));
  console.log('has job-tuple:', naukri.includes('job-tuple'));
  console.log('script srcs:', [...naukri.matchAll(/src="([^"]+\.js)"/g)].slice(0, 3).map(m => m[1]).join(', '));
}

const unstop = await probe('unstop', 'https://unstop.com/internships');
if (unstop) {
  console.log('has __NEXT_DATA__:', unstop.includes('__NEXT_DATA__'));
  console.log('has self.__next_f:', unstop.includes('self.__next_f'));
  console.log('title:', (unstop.match(/<title>([^<]+)<\/title>/) || [])[1]);
}
