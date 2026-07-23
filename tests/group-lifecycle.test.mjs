import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { formatGroupActivityEvent } from "../src/lib/group-activity.ts";
import { getGroupPermissions } from "../src/lib/groups/permissions.ts";
import {
  deleteGroupConfirmationSchema,
  updateGroupDetailsSchema,
} from "../src/lib/validations/group.ts";

const migrationUrl = new URL(
  "../supabase/migrations/13_add_group_settings_and_lifecycle.sql",
  import.meta.url,
);

test("group details trim values and normalize an empty description", () => {
  assert.deepEqual(
    updateGroupDetailsSchema.parse({
      name: "  Summer trip  ",
      description: "  Shared costs for July.  ",
    }),
    {
      name: "Summer trip",
      description: "Shared costs for July.",
    },
  );
  assert.equal(
    updateGroupDetailsSchema.parse({
      name: "Summer trip",
      description: "   ",
    }).description,
    null,
  );
  assert.equal(
    updateGroupDetailsSchema.safeParse({
      name: "Summer trip",
      description: "x".repeat(501),
    }).success,
    false,
  );
});

test("permanent deletion confirmation preserves exact case", () => {
  assert.equal(
    deleteGroupConfirmationSchema.parse({
      confirmationName: "  Summer Trip  ",
    }).confirmationName,
    "Summer Trip",
  );
});

test("archived groups remain viewable while every ordinary mutation is disabled", () => {
  const publicGuest = getGroupPermissions("public", null, true);
  const privateOwner = getGroupPermissions("private", "owner", true);
  const privateMember = getGroupPermissions("private", "member", true);
  const privateViewer = getGroupPermissions("private", "viewer", true);

  assert.equal(publicGuest.canView, true);
  assert.equal(publicGuest.canContribute, false);
  assert.equal(publicGuest.canManageMembers, false);

  assert.equal(privateOwner.canView, true);
  assert.equal(privateOwner.canEditGroup, false);
  assert.equal(privateOwner.canChangeAccess, false);
  assert.equal(privateOwner.canInvite, false);
  assert.equal(privateOwner.canRestoreGroup, true);
  assert.equal(privateOwner.canDeleteGroup, true);

  for (const permissions of [privateMember, privateViewer]) {
    assert.equal(permissions.canView, true);
    assert.equal(permissions.canContribute, false);
    assert.equal(permissions.canRestoreGroup, false);
    assert.equal(permissions.canDeleteGroup, false);
  }

  assert.equal(getGroupPermissions("private", null, true).canView, false);
});

test("group lifecycle activity avoids storing free-form descriptions", () => {
  const descriptionUpdate = formatGroupActivityEvent({
    id: "20",
    actorName: "Suman",
    eventType: "group.description_updated",
    metadata: {},
    createdAt: "2026-07-23T12:00:00.000Z",
  });
  const archived = formatGroupActivityEvent({
    id: "21",
    actorName: "Suman",
    eventType: "group.archived",
    metadata: {},
    createdAt: "2026-07-23T12:01:00.000Z",
  });
  const restored = formatGroupActivityEvent({
    id: "22",
    actorName: "Suman",
    eventType: "group.restored",
    metadata: {},
    createdAt: "2026-07-23T12:02:00.000Z",
  });

  assert.equal(descriptionUpdate.summary, "Suman updated the group description.");
  assert.equal(descriptionUpdate.details, undefined);
  assert.equal(archived.summary, "Suman archived the group.");
  assert.equal(restored.summary, "Suman restored the group.");
});

test("lifecycle migration is owner-only, archive-first, and atomically audited", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /add column description text/i);
  assert.match(migration, /add column archived_at timestamptz/i);
  assert.match(migration, /groups_description_length_check[\s\S]*500/i);

  for (const eventType of [
    "group.renamed",
    "group.description_updated",
    "group.archived",
    "group.restored",
  ]) {
    assert.match(migration, new RegExp(`'${eventType.replace(".", "\\.")}'`, "i"));
  }

  for (const functionName of [
    "update_group_details_with_activity",
    "archive_group_with_activity",
    "restore_group_with_activity",
    "permanently_delete_group",
  ]) {
    assert.match(
      migration,
      new RegExp(`create or replace function public\\.${functionName}`, "i"),
    );
    assert.match(
      migration,
      new RegExp(
        `${functionName}[\\s\\S]*created_by_user_id is distinct from p_actor_user_id`,
        "i",
      ),
    );
  }

  assert.match(
    migration,
    /permanently_delete_group[\s\S]*if v_group\.archived_at is null[\s\S]*return 'active'/i,
  );
  assert.match(
    migration,
    /update_group_details_with_activity[\s\S]*record_group_activity[\s\S]*'group\.renamed'/i,
  );
  assert.match(
    migration,
    /archive_group_with_activity[\s\S]*record_group_activity[\s\S]*'group\.archived'/i,
  );
  assert.match(
    migration,
    /restore_group_with_activity[\s\S]*record_group_activity[\s\S]*'group\.restored'/i,
  );
  assert.doesNotMatch(
    migration,
    /'group\.description_updated'[\s\S]{0,250}(?:p_description|v_description)/i,
  );
});

test("database triggers reject stale writes to archived group data", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /raise exception 'group_is_archived'/i);

  for (const table of [
    "members",
    "expenses",
    "expense_participants",
    "settlement_payments",
    "group_memberships",
    "group_invitations",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `create trigger ${table}_prevent_archived_group_mutation[\\s\\S]*before insert or update or delete on public\\.${table}`,
        "i",
      ),
    );
  }
});

test("dashboard and group access load archival state", async () => {
  const [dashboardSource, accessSource] = await Promise.all([
    readFile(new URL("../src/lib/dashboard/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/groups/access.ts", import.meta.url), "utf8"),
  ]);

  assert.match(dashboardSource, /archived_at/);
  assert.match(accessSource, /archived_at/);
  assert.match(accessSource, /group\.archived_at !== null/);
});
