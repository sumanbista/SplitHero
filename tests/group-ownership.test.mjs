import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("authenticated group owners must reference an auth user", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/05_add_authenticated_group_ownership.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    migration,
    /foreign key \(created_by_user_id\)[\s\S]*references auth\.users \(id\)/i,
  );
  assert.match(migration, /on delete set null/i);
  assert.doesNotMatch(migration, /not null/i);
});

test("Spec 012 does not add membership roles or private access policies", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/05_add_authenticated_group_ownership.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(migration, /create table[\s\S]*membership/i);
  assert.doesNotMatch(migration, /create policy/i);
  assert.doesNotMatch(migration, /\brole\b/i);
});
