export const DEFAULT_AUTHENTICATED_PATH = "/dashboard";

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

export function getPostLoginPath(value: string | null | undefined) {
  return getSafeNextPath(value, DEFAULT_AUTHENTICATED_PATH);
}

export function addAuthStatusToPath(
  value: string | null | undefined,
  status: string,
) {
  const safePath = getSafeNextPath(value);
  const url = new URL(safePath, "https://splithero.local");

  url.searchParams.set("auth", status);

  return `${url.pathname}${url.search}${url.hash}`;
}
