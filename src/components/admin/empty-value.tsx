/** `null`/`undefined`/`""` contam como "sem valor"; `0` é um valor. */
export function isEmptyValue(value: React.ReactNode) {
  return value === null || value === undefined || value === "";
}

/** "—" visual + "sem dados" para leitor de tela (KpiCard e StatCard). */
export function EmptyValue() {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">sem dados</span>
    </>
  );
}
