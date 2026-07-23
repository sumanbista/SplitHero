import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getGroupPermissions } from "../src/lib/groups/permissions.ts";
import { memberMutationSchema } from "../src/lib/validations/member.ts";

const migrationUrl = new URL(
  "../supabase/migrations/12_add_member_lifecycle.sql",
  import.meta.url,
);

test("member lifecycle inputs validate rename and status mutations", () => {
  const memberId = "11111111-1111-4111-8111-111111111111";

  assert.deepEqual(
    memberMutationSchema.parse({
      intent: "rename",
      memberId,
      name: "  Alex  ",
    }),
    { intent: "rename", memberId, name: "Alex" },
  );
  assert.equal(
    memberMutationSchema.safeParse({ intent: "archive", memberId }).success,
    true,
  );
  assert.equal(
    memberMutationSchema.safeParse({ intent: "remove", memberId: "bad" })
      .success,
    false,
  );
});

test("member lifecycle permissions preserve public guests and private ownership", () => {
  const publicGuest = getGroupPermissions("public", null);
  assert.equal(publicGuest.canRenameMembers, true);
  assert.equal(publicGuest.canArchiveMembers, true);
  assert.equal(publicGuest.canRemoveMembers, true);

  const privateOwner = getGroupPermissions("private", "owner");
  assert.equal(privateOwner.canRenameMembers, true);
  assert.equal(privateOwner.canArchiveMembers, true);
  assert.equal(privateOwner.canRemoveMembers, true);

  const privateMember = getGroupPermissions("private", "member");
  assert.equal(privateMember.canRenameMembers, false);
  assert.equal(privateMember.canArchiveMembers, false);
  assert.equal(privateMember.canRemoveMembers, false);
});

test("member lifecycle migration preserves history and records changes atomically", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /add column is_active boolean not null default true/i);
  assert.match(migration, /members_archive_state_check/i);

  for (const eventType of [
    "member.renamed",
    "member.archived",
    "member.restored",
    "member.removed",
  ]) {
    assert.match(migration, new RegExp(eventType.replace(".", "\\."), "i"));
  }

  assert.match(
    migration,
    /rename_member_with_activity[\s\S]*update public\.members[\s\S]*record_group_activity/i,
  );
  assert.match(
    migration,
    /set_member_active_with_activity[\s\S]*update public\.members[\s\S]*record_group_activity/i,
  );
  assert.match(
    migration,
    /remove_unused_member_with_activity[\s\S]*record_group_activity[\s\S]*delete from public\.members/i,
  );
});

test("permanent removal is blocked by accounts, balances, and every history source", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /v_member\.user_id is not null/i);
  assert.match(migration, /from public\.group_memberships/i);
  assert.match(migration, /v_balance_cents <> 0/i);
  assert.match(migration, /from public\.expenses/i);
  assert.match(migration, /from public\.expense_participants/i);
  assert.match(migration, /from public\.settlement_payments/i);
  assert.match(migration, /from public\.group_invitations/i);
});

test("archived members cannot be introduced to new financial or invitation records", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(
    migration,
    /create_expense_with_participants[\s\S]*and is_active/i,
  );
  assert.match(
    migration,
    /update_expense_with_participants[\s\S]*member\.is_active[\s\S]*previous_participant/i,
  );
  assert.match(migration, /group_invitations_require_active_member/i);
});
