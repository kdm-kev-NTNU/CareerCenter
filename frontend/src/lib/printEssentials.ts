/** Escape text for safe insertion into an HTML document body. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Opens a minimal document with only the essentials sheet and triggers print.
 * Returns false if the sheet is empty or the popup was blocked.
 */
export function printEssentialsSheet(
  text: string,
  openWindow: typeof window.open = window.open.bind(window)
): boolean {
  const body = text.trim();
  if (!body) return false;

  const win = openWindow("", "_blank", "noopener,noreferrer");
  if (!win) return false;

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <title>Essentials</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; margin: 2rem; color: #111; }
    h1 { font-size: 1.25rem; margin: 0 0 1rem; }
    pre { white-space: pre-wrap; font-family: inherit; font-size: 1rem; line-height: 1.45; margin: 0; }
  </style>
</head>
<body>
  <h1>Essentials</h1>
  <pre>${escapeHtml(body)}</pre>
</body>
</html>`);
  win.document.close();
  win.focus();
  win.print();
  win.close();
  return true;
}
