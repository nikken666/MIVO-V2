// Shopee photos come full size (often 1000px+). Its CDN serves a small
// version when "_tn" is added to the file name — enough for product cards.
const SHOPEE_FILE = /^(https:\/\/(?:cf\.shopee\.[a-z.]+|down-[a-z]+\.img\.susercontent\.com))\/file\/([A-Za-z0-9-]+)$/;

export function thumbUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const m = SHOPEE_FILE.exec(url.trim());
  return m ? m[1] + "/file/" + m[2] + "_tn" : url;
}
