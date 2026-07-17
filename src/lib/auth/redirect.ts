export function getSafeNextPath(
  value: string | null | undefined,
  fallback = "/",
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return fallback;
  }

  try {
    const baseUrl = new URL("https://splithero.local");
    const nextUrl = new URL(value, baseUrl);

    if (nextUrl.origin !== baseUrl.origin) {
      return fallback;
    }

    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  } catch {
    return fallback;
  }
}
