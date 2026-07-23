export function getMemberInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  const firstInitial = Array.from(words[0])[0] ?? "";
  const lastInitial =
    words.length > 1 ? (Array.from(words.at(-1) ?? "")[0] ?? "") : "";

  return `${firstInitial}${lastInitial}`.toLocaleUpperCase();
}

export function getMemberDisplayName(
  memberName: string,
  profileDisplayName: string | null | undefined,
) {
  return memberName.trim() || profileDisplayName?.trim() || "Unnamed member";
}
