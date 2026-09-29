// Seeded random numbers so every house is procedurally generated but repeatable.
class RNG {
  constructor(seed) { this.s = seed >>> 0; }
  next() {
    let t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  f(a, b) { return a + (b - a) * this.next(); }
  i(a, b) { return Math.floor(this.f(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  gauss() { return (this.next() + this.next() + this.next() - 1.5) / 0.5; }
  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
}
function hash2(a, b) {
  let h = Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ Math.imul((b + 0x632be5ab) >>> 0, 0xc2b2ae35);
  h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 16;
  return h >>> 0;
}
