import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createInvitationSchema, invitationTokenSchema } from "../src/lib/validations/invitation.ts";

const migrationUrl = new URL(
  "../supabase/migrations/06_add_group_memberships_and_invitations.sql",
  import.meta.url,
);

test("invitation input normalizes email and supports member roles", () => {
  const invitation = createInvitationSchema.parse({
    email: "  PERSON@Example.COM ",
    role: "viewer",
    memberId: "none",
  });

  assert.equal(invitation.email, "person@example.com");
  assert.equal(invitation.role, "viewer");
  assert.equal(invitation.memberId, null);
});

test("invitation tokens require 256 bits encoded as base64url", () => {
  assert.equal(invitationTokenSchema.safeParse("a".repeat(43)).success, true);
  assert.equal(invitationTokenSchema.safeParse("short").success, false);
  assert.equal(invitationTokenSchema.safeParse(`${"a".repeat(42)}!`).success, false);
});

test("membership and invitation schema enforces secure lifecycle constraints", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /create table public\.group_memberships/i);
  assert.match(migration, /unique \(group_id, user_id\)/i);
  assert.match(migration, /role in \('owner', 'member', 'viewer'\)/i);
  assert.match(migration, /create table public\.group_invitations/i);
  assert.match(migration, /members_user_id_fkey[\s\S]*references auth\.users \(id\)/i);
  assert.match(migration, /unique \(token_hash\)/i);
  assert.match(migration, /where status = 'pending'/i);
  assert.match(migration, /invited_member_id is not null and status = 'pending'/i);
  assert.match(migration, /status in \('pending', 'accepted', 'declined', 'expired', 'revoked'\)/i);
  assert.match(migration, /alter table public\.group_invitations enable row level security/i);
});

test("acceptance atomically links an existing expense member without replacing it", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /create or replace function public\.accept_group_invitation/i);
  assert.match(migration, /from public\.group_invitations[\s\S]*for update/i);
  assert.match(migration, /update public\.members[\s\S]*set user_id = p_user_id/i);
  assert.doesNotMatch(migration, /delete from public\.members/i);
  assert.match(migration, /grant execute on function public\.accept_group_invitation[\s\S]*to service_role/i);
  assert.match(migration, /revoke all on function public\.accept_group_invitation[\s\S]*from public, anon, authenticated/i);
});

test("owner membership is backfilled and created for new authenticated groups", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /insert into public\.group_memberships[\s\S]*from public\.groups[\s\S]*created_by_user_id is not null/i);
  assert.match(migration, /create trigger groups_create_owner_membership/i);
});
