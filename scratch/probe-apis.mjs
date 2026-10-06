// One-off probe: hunt for usable JSON endpoints. Run: node scratch/probe-apis.mjs
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, Accept: 'application/json', 'Accept-Language': 'en-IN,en;q=0.9' };

async function probe(name, url, extra = {}) {
  try {
    const res = await fetch(url, { headers: { ...H, ...extra } });
    const text = await res.text();
    let info = `${res.status}, ${text.length}B`;
    try {
      const json = JSON.parse(text);
      const keys = Object.keys(json).slice(0, 6).join(',');
      info += `  JSON keys: ${keys}`;
      for (const k of ['jobs', 'data', 'results', 'opportunities', 'content']) {
        if (Array.isArray(json[k])) info += ` | ${k}[${json[k].length}] first=${JSON.stringify(json[k][0])?.slice(0, 150)}`;
      }
    } catch { /* not json */ }
    console.log(`${name.padEnd(28)} ${info}`);
  } catch (e) {
    console.log(`${name.padEnd(28)} FAILED ${e.cause?.code || e.message}`);
  }
}

// Naukri internal job API (used by their SPA)
await probe('naukri jobapi', 'https://www.naukri.com/jobapi/v4/search?noOfResults=20&urlType=search_by_keyword&searchType=adv&keyword=internship&seoKey=internship-jobs&src=jobsearchDesk&latLong=', {
  appid: '121', systemid: 'Naukri', 'Content-Type': 'application/json',
});

// Unstop public API candidates
await probe('unstop api v1', 'https://unstop.com/api/public/opportunity?opportunity=internship&page=1&per_page=10');
await probe('unstop api list', 'https://unstop.com/api/public/opportunity/list?opportunity=internship&page=1');
await probe('unstop api filters', 'https://unstop.com/api/public/opportunity/filters?type=internships');

// Internshala retry stability check
for (let i = 1; i <= 2; i++) {
  await probe(`internshala run ${i}`, 'https://internshala.com/internships/', { Accept: 'text/html,application/xhtml+xml' });
}

// Instahyre with fuller browser headers
await probe('instahyre full-headers', 'https://www.instahyre.com/search-jobs/', {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Cache-Control': 'no-cache',
  Referer: 'https://www.instahyre.com/',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Upgrade-Insecure-Requests': '1',
});
