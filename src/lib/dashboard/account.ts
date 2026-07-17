export function getAccountDisplayName(
  displayName: string | null | undefined,
  email: string | null | undefined,
) {
  const normalizedName = displayName?.trim();

  if (normalizedName) {
    return normalizedName;
  }

  return email?.trim() || "SplitHero member";
}

export function getAccountInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1 && words[0].includes("@")) {
    return (Array.from(words[0])[0] ?? "?").toLocaleUpperCase();
  }

  const firstInitial = Array.from(words[0])[0] ?? "";
  const lastInitial =
    words.length > 1 ? (Array.from(words.at(-1) ?? "")[0] ?? "") : "";

  return `${firstInitial}${lastInitial}`.toLocaleUpperCase();
}
