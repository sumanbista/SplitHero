import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const migrationDirectory = path.join(
  process.cwd(),
  "supabase",
  "migrations",
);
const migrationFilePattern = /^(\d+)_([a-z0-9_]+)\.sql$/;

const entries = await readdir(migrationDirectory, { withFileTypes: true });
const migrationFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .toSorted();

assert.ok(migrationFiles.length > 0, "No Supabase migrations were found.");

const versions = migrationFiles.map((fileName) => {
  const match = migrationFilePattern.exec(fileName);
  assert.ok(
    match,
    `${fileName} must use the format <number>_<snake_case_name>.sql.`,
  );
  return Number(match[1]);
});

assert.equal(
  new Set(versions).size,
  versions.length,
  "Migration version prefixes must be unique.",
);

for (let index = 1; index < versions.length; index += 1) {
  assert.ok(
    versions[index] > versions[index - 1],
    "Migration versions must increase in filename order.",
  );
}

const migrationSql = (
  await Promise.all(
    migrationFiles.map((fileName) =>
      readFile(path.join(migrationDirectory, fileName), "utf8"),
    ),
  )
).join("\n");

const tables = [
  "groups",
  "members",
  "expenses",
  "expense_participants",
  "settlement_payments",
  "profiles",
  "group_memberships",
  "group_invitations",
  "security_rate_limits",
  "security_audit_log",
];

for (const table of tables) {
  assert.match(
    migrationSql,
    new RegExp(`create table public\\.${table}\\s*\\(`, "i"),
    `Missing public.${table} table migration.`,
  );
  assert.match(
    migrationSql,
    new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    `Row level security must be enabled for public.${table}.`,
  );
}

const serviceRoleFunctions = [
  "create_expense_with_participants",
  "record_recommended_settlement_payment",
  "consume_security_rate_limit",
];

for (const functionName of serviceRoleFunctions) {
  assert.match(
    migrationSql,
    new RegExp(
      `create or replace function public\\.${functionName}\\s*\\(`,
      "i",
    ),
    `Missing public.${functionName} function migration.`,
  );
  assert.match(
    migrationSql,
    new RegExp(
      `grant execute on function public\\.${functionName}\\s*\\([\\s\\S]*?\\)\\s+to service_role`,
      "i",
    ),
    `public.${functionName} must be executable by service_role.`,
  );
  assert.match(
    migrationSql,
    new RegExp(
      `revoke all on function public\\.${functionName}\\s*\\([\\s\\S]*?\\)\\s+from public, anon, authenticated`,
      "i",
    ),
    `public.${functionName} must not be executable by browser roles.`,
  );
}

assert.match(
  migrationSql,
  /revoke insert, update, delete on public\.groups from authenticated/i,
  "Authenticated browser clients must not bypass Server Action mutations.",
);
assert.match(
  migrationSql,
  /revoke all on table public\.security_rate_limits from public, anon, authenticated/i,
  "Rate-limit state must remain server-only.",
);
assert.match(
  migrationSql,
  /revoke all on table public\.security_audit_log from public, anon, authenticated/i,
  "Security audit events must remain server-only.",
);
assert.match(
  migrationSql,
  /elsif tg_table_name = 'group_memberships' then\s+if new\.member_id is not null/i,
  "Nullable group membership links must remain inside their table branch.",
);
assert.match(
  migrationSql,
  /insert into public\.members \(group_id, name, user_id\)[\s\S]*returning id into v_member_id/i,
  "Authenticated group owners must receive an expense participant record.",
);

const functionDefinitions = migrationSql.matchAll(
  /create or replace function public\.[\s\S]*?\$\$;/gi,
);

for (const [definition] of functionDefinitions) {
  assert.match(
    definition,
    /set search_path = ''/i,
    "Every database function must pin an empty search_path.",
  );
}

console.log(`Verified ${migrationFiles.length} ordered Supabase migrations.`);
