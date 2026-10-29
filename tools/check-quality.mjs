// Self-check for src/quality.js (adaptive resolution): node tools/check-quality.mjs
globalThis.window = { devicePixelRatio: 2 };
const { createAdaptiveRatio } = await import('../src/quality.js');
const assert = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
let q;
const run = (ms, sec) => { for (let i = 0; i < sec * 1000 / ms; i++) q.tick(ms); };

q = createAdaptiveRatio(() => {});
run(16.7, 20);  assert(q.ratio === 2, 'steady 60 fps keeps 2');
run(30, 2);     assert(q.ratio === 1.5, 'slow frames step down once');
run(30, 10);    assert(q.ratio === 1, 'and on down to the floor');
run(8, 8);      assert(q.ratio === 1, 'no step up right after a drop (30 s lock)');
run(8, 60);     assert(q.ratio === 2, 'fast frames step back up, one notch at a time');
run(500, 10);   assert(q.ratio === 2, 'hidden-tab sized gaps are ignored');

// 60 Hz screen (frames never < 11 ms): probes up after 30 s calm; a failed probe backs off
q = createAdaptiveRatio(() => {});
run(30, 2);       assert(q.ratio === 1.5, 'start slow: down');
run(16.7, 50);  assert(q.ratio === 2, 'calm at 60 Hz: probes up');
run(30, 2);       assert(q.ratio === 1.5, 'failed probe: down again');
run(16.7, 50);  assert(q.ratio === 1.5, 'probe lock is longer the second time');
run(16.7, 40);  assert(q.ratio === 2, 'then it tries again');
console.log('OK: adaptive resolution');
