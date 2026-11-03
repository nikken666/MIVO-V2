import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, translator, type Locale } from "./index";

export async function getLocale(): Promise<Locale> {
  try {
    const value = (await cookies()).get(LOCALE_COOKIE)?.value;
    return isLocale(value) ? value : "en";
  } catch {
    return "en";
  }
}

export async function getT() {
  return translator(await getLocale());
}
