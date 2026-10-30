// Product descriptions are often pasted from marketplaces as HTML. Render them
// as plain text (never as HTML) so tags don't leak onto the page.
const entities: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

export function htmlToParagraphs(value: string | null | undefined): string[] {
  if (!value) return [];

  return value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (match) => entities[match] ?? match)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function htmlToPlainText(value: string | null | undefined): string {
  return htmlToParagraphs(value).join(" ");
}
