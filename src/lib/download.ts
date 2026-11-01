/** Entrega o arquivo ao navegador: cria o link, clica e libera a URL do Blob. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Dá tempo ao navegador de iniciar o download antes de liberar o Blob.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
