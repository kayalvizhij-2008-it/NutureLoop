const fs = require('fs');
const pages = ['index.html', 'app.html', 'journey.html', 'care-plan.html', 'carebridge.html', 'more.html'];
let issues = 0;
const flag = (p, m) => { console.log('  [' + p + '] ' + m); issues++; };

for (const p of pages) {
  const s = fs.readFileSync(p, 'utf8');
  // fixed pixel widths on structural elements
  for (const m of s.matchAll(/class="([^"]*\bw-(?:\[[\d.]+(?:px|rem)\]|1[0-9]{2,}|2[0-9]{2,})[^"]*)"/g)) {
    // w-[420px] style arbitrary values are fine if inside hidden lg: contexts — flag raw ones
    flag(p, 'wide fixed width class: ' + m[1].slice(0, 80));
  }
  // min-width styles that exceed 320
  for (const m of s.matchAll(/style="[^"]*min-width:\s*([3-9]\d\d|[1-9]\d{3})px[^"]*"/g)) {
    flag(p, 'inline min-width ' + m[1] + 'px');
  }
  // w-[] arbitrary with vw under 100 but px > 300 without responsive prefix
  for (const m of s.matchAll(/(?:^|\s)(w-\[[^\]]*\d{3,}px\]|\[width:[^\]]*\d{3,}px\])/g)) {
    flag(p, 'arbitrary width: ' + m[1]);
  }
  // grid-cols fixed high counts (would squeeze on mobile)
  for (const m of s.matchAll(/class="[^"]*\bgrid-cols-([4-9]|1[0-9])\b[^"]*"/g)) {
    if (!/md:|lg:|sm:/.test(m[0])) flag(p, 'unresponsive grid-cols-' + m[1] + ': ' + m[0].slice(0, 90));
  }
  // flex rows with many fixed children and no wrap (heuristic: flex + min-w in px)
  for (const m of s.matchAll(/min-w-\[(\d{3,})px\]/g)) {
    if (parseInt(m[1], 10) > 280) flag(p, 'min-w[' + m[1] + 'px] may overflow 320px screens');
  }
}
console.log(issues ? issues + ' static flags' : 'static pass clean');
