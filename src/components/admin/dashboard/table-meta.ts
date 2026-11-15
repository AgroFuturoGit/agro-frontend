// Metadados de coluna compartilhados pelas tabelas da Visão geral: números à
// direita com `tabular-nums` e cabeçalhos longos quebrando linha, para que as
// tabelas largas caibam em 1440px sem rolagem.
export const WRAP_HEADER = "whitespace-normal leading-tight";
export const TEXT_CELL = "min-w-28 whitespace-normal";
export const NUMERIC = { numeric: true, headerClassName: WRAP_HEADER } as const;
export const NAME_CELL = { cellVariant: "primary", cellClassName: TEXT_CELL } as const;
