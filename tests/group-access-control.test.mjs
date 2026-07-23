import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getGroupPermissions } from "../src/lib/groups/permissions.ts";
import { groupAccessModeSchema } from "../src/lib/validations/group.ts";

const migrationUrl = new URL(
  "../supabase/migrations/07_add_private_group_access_control.sql",
  import.meta.url,
);

test("group access settings accept only public and private modes", () => {
  assert.equal(groupAccessModeSchema.parse("public"), "public");
  assert.equal(groupAccessModeSchema.parse("private"), "private");
  assert.equal(groupAccessModeSchema.safeParse("secret").success, false);
});

test("public share links preserve guest viewing and contributions", () => {
  const permissions = getGroupPermissions("public", null);

  assert.equal(permissions.canView, true);
  assert.equal(permissions.canManageMembers, true);
  assert.equal(permissions.canContribute, true);
  assert.equal(permissions.canInvite, false);
  assert.equal(permissions.canChangeAccess, false);
});

test("private roles enforce owner member and viewer permissions", () => {
  assert.deepEqual(getGroupPermissions("private", "owner"), {
    canView: true,
    canEditGroup: true,
    canArchiveGroup: true,
    canRestoreGroup: false,
    canDeleteGroup: false,
    canManageMembers: true,
    canRenameMembers: true,
    canArchiveMembers: true,
    canRemoveMembers: true,
    canContribute: true,
    canEditExpenses: true,
    canDeleteExpenses: true,
    canInvite: true,
    canChangeAccess: true,
  });
  assert.deepEqual(getGroupPermissions("private", "member"), {
    canView: true,
    canEditGroup: false,
    canArchiveGroup: false,
    canRestoreGroup: false,
    canDeleteGroup: false,
    canManageMembers: false,
    canRenameMembers: false,
    canArchiveMembers: false,
    canRemoveMembers: false,
    canContribute: true,
    canEditExpenses: true,
    canDeleteExpenses: true,
    canInvite: false,
    canChangeAccess: false,
  });
  assert.deepEqual(getGroupPermissions("private", "viewer"), {
    canView: true,
    canEditGroup: false,
    canArchiveGroup: false,
    canRestoreGroup: false,
    canDeleteGroup: false,
    canManageMembers: false,
    canRenameMembers: false,
    canArchiveMembers: false,
    canRemoveMembers: false,
    canContribute: false,
    canEditExpenses: false,
    canDeleteExpenses: false,
    canInvite: false,
    canChangeAccess: false,
  });
  assert.equal(getGroupPermissions("private", null).canView, false);
});

test("access-control migration defaults existing groups to public", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /add column access_mode text not null default 'public'/i);
  assert.match(migration, /access_mode in \('public', 'private'\)/i);
  assert.match(migration, /revoke all on table[\s\S]*from anon/i);
});

test("RLS maps private reads and mutations to membership roles", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /create policy groups_authenticated_select/i);
  assert.match(migration, /create policy members_owner_insert/i);
  assert.match(migration, /create policy expenses_contributor_insert/i);
  assert.match(migration, /create policy settlement_payments_contributor_insert/i);
  assert.match(migration, /current_group_role\(p_group_id\)[\s\S]*'owner', 'member'/i);
  assert.match(migration, /group_invitations_owner_insert/i);
});

test("every existing mutation rechecks group access on the server", async () => {
  const files = [
    "../src/lib/actions/members.ts",
    "../src/lib/actions/expenses.ts",
    "../src/lib/actions/settlements.ts",
    "../src/lib/actions/invitations.ts",
    "../src/lib/actions/groups.ts",
  ];

  const sources = await Promise.all(
    files.map((file) => readFile(new URL(file, import.meta.url), "utf8")),
  );

  for (const source of sources) {
    assert.match(source, /getGroupAccess\(shareToken\)/);
  }
});
