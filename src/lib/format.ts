export function fmtMoney(n: number, cur = 'DKK'): string {
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: cur,
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
