import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getGroupPermissions } from "../src/lib/groups/permissions.ts";
import { sensitiveActionPolicies } from "../src/lib/security/rate-limit-policy.ts";

const hardeningMigrationUrl = new URL(
  "../supabase/migrations/08_add_security_hardening.sql",
  import.meta.url,
);
const invitationMigrationUrl = new URL(
  "../supabase/migrations/06_add_group_memberships_and_invitations.sql",
  import.meta.url,
);

async function readTree(directory) {
  const directoryPath = directory instanceof URL ? fileURLToPath(directory) : directory;
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      return entry.isDirectory() ? readTree(entryPath) : readFile(entryPath, "utf8");
    }),
  );
  return contents.flat(Infinity).join("\n");
}

test("unauthenticated and cross-user sessions cannot access private groups", () => {
  assert.deepEqual(getGroupPermissions("private", null), {
    canView: false,
    canManageMembers: false,
    canContribute: false,
    canInvite: false,
    canChangeAccess: false,
  });
});

test("private role mutations remain least-privilege", () => {
  assert.equal(getGroupPermissions("private", "owner").canManageMembers, true);
  assert.equal(getGroupPermissions("private", "member").canContribute, true);
  assert.equal(getGroupPermissions("private", "member").canManageMembers, false);
  assert.equal(getGroupPermissions("private", "viewer").canContribute, false);
  assert.equal(getGroupPermissions("private", "viewer").canInvite, false);
});

test("expired sessions fail closed while public share links remain compatible", async () => {
  const sessionSource = await readFile(
    new URL("../src/lib/auth/session.ts", import.meta.url),
    "utf8",
  );

  assert.match(sessionSource, /supabase\.auth\.getUser\(\)/);
  assert.equal(getGroupPermissions("private", null).canView, false);
  assert.equal(getGroupPermissions("public", null).canView, true);
  assert.equal(getGroupPermissions("public", null).canContribute, true);
});

test("invitation acceptance is row-locked and replay-safe", async () => {
  const migration = await readFile(invitationMigrationUrl, "utf8");

  assert.match(migration, /from public\.group_invitations[\s\S]*for update/i);
  assert.match(
    migration,
    /status = 'accepted'[\s\S]*accepted_by_user_id = p_user_id[\s\S]*return query/i,
  );
  assert.match(migration, /unique \(group_id, user_id\)/i);
  assert.match(migration, /where status = 'pending'/i);
});

test("anonymous claiming and duplicate-claim surfaces remain intentionally absent", async () => {
  const implementation = await Promise.all([
    readTree(new URL("../src", import.meta.url)),
    readTree(new URL("../supabase/migrations", import.meta.url)),
  ]);

  assert.doesNotMatch(implementation.join("\n"), /claim_(?:anonymous_)?group/i);
  assert.doesNotMatch(implementation.join("\n"), /anonymous_group_claim/i);
});

test("browser roles cannot bypass hardened Server Action mutations", async () => {
  const migration = await readFile(hardeningMigrationUrl, "utf8");

  for (const table of [
    "groups",
    "members",
    "expenses",
    "expense_participants",
    "settlement_payments",
    "group_memberships",
    "group_invitations",
  ]) {
    assert.match(
      migration,
      new RegExp(`revoke insert, update, delete on public\\.${table} from authenticated`, "i"),
    );
  }

  assert.match(migration, /security_rate_limits enable row level security/i);
  assert.match(migration, /security_audit_log enable row level security/i);
  assert.match(migration, /grant execute on function public\.consume_security_rate_limit[\s\S]*to service_role/i);
});

test("database guards reject cross-group financial and membership references", async () => {
  const migration = await readFile(hardeningMigrationUrl, "utf8");

  for (const trigger of [
    "expenses_enforce_same_group",
    "expense_participants_enforce_same_group",
    "settlement_payments_enforce_same_group",
    "group_memberships_enforce_same_group",
    "group_invitations_enforce_same_group",
  ]) {
    assert.match(migration, new RegExp(`create trigger ${trigger}`, "i"));
  }
});

test("every sensitive mutation class has a bounded rate-limit policy", () => {
  for (const [action, policy] of Object.entries(sensitiveActionPolicies)) {
    assert.match(action, /^[a-z]+\.[a-z_.]+$/);
    assert.ok(policy.limit > 0 && policy.limit <= 120);
    assert.ok(policy.windowSeconds >= 60 && policy.windowSeconds <= 86_400);
  }

  assert.ok(sensitiveActionPolicies["invitation.create.user"]);
  assert.ok(sensitiveActionPolicies["invitation.create.group"]);
  assert.ok(sensitiveActionPolicies["auth.password_reset"]);
  assert.ok(sensitiveActionPolicies["group.create"]);
});

test("the service-role key is confined to server-only code and never public-prefixed", async () => {
  const adminSource = await readFile(
    new URL("../src/lib/supabase/admin.ts", import.meta.url),
    "utf8",
  );
  const sourceTree = await readTree(new URL("../src", import.meta.url));

  assert.match(adminSource, /import "server-only"/);
  assert.doesNotMatch(sourceTree, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(sourceTree, /NEXT_PUBLIC_.*SERVICE_ROLE/i);
});

test("production responses include transport and cross-origin hardening headers", async () => {
  const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");

  assert.match(config, /Strict-Transport-Security/);
  assert.match(config, /Cross-Origin-Opener-Policy/);
  assert.match(config, /X-Content-Type-Options/);
  assert.match(config, /X-Frame-Options/);
});
