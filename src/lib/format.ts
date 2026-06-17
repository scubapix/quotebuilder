export const TAX = 0.10;

export function money(cents: number | string | null | undefined): string {
  const dollars = (Number(cents) || 0) / 100;
  return (
    "$" +
    dollars.toLocaleString("en-AU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}
