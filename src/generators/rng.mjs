export function createRng(seed) {
  let state = hashSeed(String(seed));
  return {
    next() {
      state = state * 16807 % 2147483647;
      return (state - 1) / 2147483646;
    },
    int(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick(values) {
      return values[this.int(0, values.length - 1)];
    },
    fork(label) {
      return createRng(`${seed}:${label}`);
    }
  };
}

export function hashSeed(value) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 2147483647;
  }
  return Math.max(1, hash);
}
