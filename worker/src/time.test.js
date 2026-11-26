import { isZurich0437Hour, zurichParts } from './time.js';

const cases = [
  // Winter, CET (UTC+1): 03:37 UTC is 04:37 Zurich; 02:37 UTC is 03:37 Zurich.
  ['2026-01-15T03:37:00Z', true, '2026-01-15', 4, 37],
  ['2026-01-15T02:37:00Z', false, '2026-01-15', 3, 37],
  // Summer, CEST (UTC+2): 02:37 UTC is 04:37 Zurich; 03:37 UTC is 05:37 Zurich.
  ['2026-07-15T02:37:00Z', true, '2026-07-15', 4, 37],
  ['2026-07-15T03:37:00Z', false, '2026-07-15', 5, 37],
  // 27 Nov 2026 is after the DST change, so CET again.
  ['2026-11-27T03:37:00Z', true, '2026-11-27', 4, 37],
  ['2026-11-27T02:37:00Z', false, '2026-11-27', 3, 37],
];

let failed = 0;
for (const [iso, expect, date, hour, minute] of cases) {
  const when = new Date(iso);
  const parts = zurichParts(when);
  const hit = isZurich0437Hour(when);
  const ok = hit === expect && parts.date === date && parts.hour === hour && parts.minute === minute;
  if (!ok) {
    failed++;
    console.error(`FAIL ${iso}: got hit=${hit} ${parts.date} ${parts.hour}:${parts.minute}, expected hit=${expect} ${date} ${hour}:${minute}`);
  } else {
    console.log(`ok   ${iso} -> ${parts.date} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')} hit=${hit}`);
  }
}
if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('all passed');
