import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { formatGroupActivityEvent } from "../src/lib/group-activity.ts";

const migrationUrl = new URL(
  "../supabase/migrations/11_add_group_activity.sql",
  import.meta.url,
);

test("formats detailed expense edits without exposing notes", () => {
  const activity = formatGroupActivityEvent({
    id: "1",
    actorName: "Suman",
    eventType: "expense.updated",
    metadata: {
      changes: ["amount", "payer", "notes"],
      title: "Dinner",
      previousAmountCents: 4500,
      amountCents: 6000,
      previousPayerName: "Alex",
      payerName: "Maya",
    },
    createdAt: "2026-07-22T12:00:00.000Z",
  });

  assert.equal(activity.summary, "Suman edited “Dinner”.");
  assert.equal(
    activity.details,
    "Amount: $45.00 → $60.00 · Payer: Alex → Maya · Notes changed",
  );
  assert.doesNotMatch(activity.details, /note content/i);
});

test("retains a useful snapshot for deleted expenses", () => {
  const activity = formatGroupActivityEvent({
    id: "2",
    actorName: "A guest using the shared link",
    eventType: "expense.deleted",
    metadata: { title: "Taxi", amountCents: 2800 },
    createdAt: "2026-07-22T12:00:00.000Z",
  });

  assert.equal(
    activity.summary,
    "A guest using the shared link deleted “Taxi” for $28.00.",
  );
});

test("formats member lifecycle snapshots", () => {
  const renamed = formatGroupActivityEvent({
    id: "3",
    actorName: "Alex",
    eventType: "member.renamed",
    metadata: { previousName: "Sam", memberName: "Sammy" },
    createdAt: "2026-07-22T12:00:00.000Z",
  });
  const archived = formatGroupActivityEvent({
    id: "4",
    actorName: "Alex",
    eventType: "member.archived",
    metadata: { memberName: "Sammy" },
    createdAt: "2026-07-22T12:00:00.000Z",
  });

  assert.equal(renamed.summary, "Alex renamed a member.");
  assert.equal(renamed.details, "“Sam” → “Sammy”");
  assert.equal(archived.summary, "Alex archived Sammy.");
});

test("activity migration is append-only and records mutations atomically", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /create table public\.group_activity_events/i);
  assert.match(
    migration,
    /revoke all on table public\.group_activity_events from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /create trigger group_activity_events_prevent_mutation[\s\S]*before update or delete/i,
  );
  assert.match(migration, /raise exception 'group_activity_is_append_only'/i);
  assert.match(
    migration,
    /group_activity_events_group_created_at_idx[\s\S]*created_at desc, id desc/i,
  );

  for (const eventType of [
    "expense.created",
    "expense.updated",
    "expense.deleted",
    "settlement.recorded",
    "member.added",
    "group.access_changed",
    "invitation.sent",
    "invitation.accepted",
    "invitation.declined",
  ]) {
    assert.match(
      migration,
      new RegExp(`record_group_activity[\\s\\S]*'${eventType.replace(".", "\\.")}'`, "i"),
    );
  }

  assert.match(
    migration,
    /revoke all on function public\.record_group_activity[\s\S]*service_role/i,
  );
  assert.doesNotMatch(
    migration,
    /jsonb_build_object\([\s\S]{0,200}'email'/i,
  );
});
