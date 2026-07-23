const activityCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrencyFromCents(amountCents: number) {
  return activityCurrencyFormatter.format(amountCents / 100);
}

export type GroupActivityEventType =
  | "group.created"
  | "group.renamed"
  | "group.description_updated"
  | "group.access_changed"
  | "group.archived"
  | "group.restored"
  | "member.added"
  | "member.renamed"
  | "member.archived"
  | "member.restored"
  | "member.removed"
  | "expense.created"
  | "expense.updated"
  | "expense.deleted"
  | "settlement.recorded"
  | "invitation.sent"
  | "invitation.accepted"
  | "invitation.declined";

export type GroupActivityRow = {
  id: string;
  actorName: string;
  eventType: GroupActivityEventType;
  metadata: unknown;
  createdAt: string;
};

export type GroupActivityItem = {
  id: string;
  eventType: GroupActivityEventType;
  summary: string;
  details?: string;
  createdAt: string;
};

function getMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}

function getNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : undefined;
}

function getStrings(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function quoted(value: string | undefined, fallback: string) {
  return `“${value ?? fallback}”`;
}

function expenseUpdateDetails(metadata: Record<string, unknown>) {
  const changes = new Set(getStrings(metadata, "changes"));
  const details: string[] = [];

  if (changes.has("title")) {
    details.push(
      `Title: ${quoted(getString(metadata, "previousTitle"), "Untitled")} → ${quoted(getString(metadata, "title"), "Untitled")}`,
    );
  }

  if (changes.has("amount")) {
    const previousAmount = getNumber(metadata, "previousAmountCents");
    const amount = getNumber(metadata, "amountCents");
    if (previousAmount !== undefined && amount !== undefined) {
      details.push(
        `Amount: ${formatCurrencyFromCents(previousAmount)} → ${formatCurrencyFromCents(amount)}`,
      );
    }
  }

  if (changes.has("payer")) {
    details.push(
      `Payer: ${getString(metadata, "previousPayerName") ?? "Unknown member"} → ${getString(metadata, "payerName") ?? "Unknown member"}`,
    );
  }
  if (changes.has("participants")) details.push("Participants changed");
  if (changes.has("date")) details.push("Date changed");
  if (changes.has("notes")) details.push("Notes changed");

  return details.join(" · ") || undefined;
}

export function formatGroupActivityEvent(
  row: GroupActivityRow,
): GroupActivityItem {
  const metadata = getMetadata(row.metadata);
  const actor = row.actorName;
  let summary: string;
  let details: string | undefined;

  switch (row.eventType) {
    case "group.created":
      summary = `${actor} created the group.`;
      break;
    case "group.renamed":
      summary = `${actor} renamed the group.`;
      details = `${quoted(getString(metadata, "previousName"), "Untitled")} → ${quoted(getString(metadata, "groupName"), "Untitled")}`;
      break;
    case "group.description_updated":
      summary = `${actor} updated the group description.`;
      break;
    case "group.access_changed":
      summary = `${actor} made the group ${getString(metadata, "accessMode") ?? "private"}.`;
      break;
    case "group.archived":
      summary = `${actor} archived the group.`;
      break;
    case "group.restored":
      summary = `${actor} restored the group.`;
      break;
    case "member.added":
      summary = `${actor} added ${getString(metadata, "memberName") ?? "a member"} to the group.`;
      break;
    case "member.renamed":
      summary = `${actor} renamed a member.`;
      details = `${quoted(getString(metadata, "previousName"), "Unknown member")} → ${quoted(getString(metadata, "memberName"), "Unknown member")}`;
      break;
    case "member.archived":
      summary = `${actor} archived ${getString(metadata, "memberName") ?? "a member"}.`;
      break;
    case "member.restored":
      summary = `${actor} restored ${getString(metadata, "memberName") ?? "a member"}.`;
      break;
    case "member.removed":
      summary = `${actor} permanently removed ${getString(metadata, "memberName") ?? "an unused member"}.`;
      break;
    case "expense.created": {
      const amount = getNumber(metadata, "amountCents");
      summary = `${actor} added ${quoted(getString(metadata, "title"), "an expense")}${amount === undefined ? "." : ` for ${formatCurrencyFromCents(amount)}.`}`;
      break;
    }
    case "expense.updated":
      summary = `${actor} edited ${quoted(getString(metadata, "title"), "an expense")}.`;
      details = expenseUpdateDetails(metadata);
      break;
    case "expense.deleted": {
      const amount = getNumber(metadata, "amountCents");
      summary = `${actor} deleted ${quoted(getString(metadata, "title"), "an expense")}${amount === undefined ? "." : ` for ${formatCurrencyFromCents(amount)}.`}`;
      break;
    }
    case "settlement.recorded": {
      const amount = getNumber(metadata, "amountCents");
      summary = `${actor} recorded${amount === undefined ? "" : ` ${formatCurrencyFromCents(amount)}`} from ${getString(metadata, "fromMemberName") ?? "a member"} to ${getString(metadata, "toMemberName") ?? "a member"}.`;
      break;
    }
    case "invitation.sent": {
      const linkedMemberName = getString(metadata, "linkedMemberName");
      const role = getString(metadata, "role") ?? "member";
      summary = linkedMemberName
        ? `${actor} invited someone to connect with ${linkedMemberName}.`
        : `${actor} invited someone as a ${role}.`;
      break;
    }
    case "invitation.accepted":
      summary = `${actor} joined the group as a ${getString(metadata, "role") ?? "member"}.`;
      break;
    case "invitation.declined":
      summary = `${actor} declined a group invitation.`;
      break;
    default: {
      const exhaustiveEvent: never = row.eventType;
      summary = `${actor} updated the group (${exhaustiveEvent}).`;
    }
  }

  return {
    id: row.id,
    eventType: row.eventType,
    summary,
    details,
    createdAt: row.createdAt,
  };
}
