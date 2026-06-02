export function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

export function simplifyFraction(numerator, denominator) {
  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: sign * numerator / divisor,
    denominator: Math.abs(denominator / divisor)
  };
}

export function formatFraction(fraction) {
  if (fraction.denominator === 1) return String(fraction.numerator);
  return `${fraction.numerator}/${fraction.denominator}`;
}

export function money(value) {
  return Number(value).toFixed(2);
}
