/** Rótulos de safra costumam já começar com "Safra": evita "Safra Safra 2026". */
export function harvestText(label: string | null | undefined): string {
  const value = label?.trim();
  if (!value) return "Safra —";
  return /^safra\b/i.test(value) ? value : `Safra ${value}`;
}
