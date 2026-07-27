import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/14_add_custom_expense_splits.sql",
  import.meta.url,
);

test("custom split migration stores finalized cents and percentage metadata", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(
    migration,
    /alter table public\.expenses[\s\S]*add column split_mode text not null default 'equal'/i,
  );
  assert.match(
    migration,
    /alter table public\.expense_participants[\s\S]*add column percentage_basis_points integer/i,
  );
  assert.match(
    migration,
    /sum\(share_cents\)[\s\S]*v_share_total <> p_amount_cents/i,
  );
  assert.match(
    migration,
    /sum\(basis_points\)[\s\S]*<> 10000/i,
  );
  assert.match(
    migration,
    /v_previous_participant_shares is distinct from v_new_participant_shares[\s\S]*array_append\(v_changes, 'split'\)/i,
  );
});

test("custom split RPCs remain server-only", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  for (const functionName of [
    "create_expense_with_participants",
    "update_expense_with_participants",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${functionName}[\\s\\S]*?from public, anon, authenticated`,
        "i",
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `grant execute on function public\\.${functionName}[\\s\\S]*?to service_role`,
        "i",
      ),
    );
  }
});

test("previous equal-split RPC signatures delegate safely during rollout", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(
    migration,
    /previous Server Action signature[\s\S]*create or replace function public\.create_expense_with_participants[\s\S]*'equal',\s+null::integer\[\]/i,
  );
  assert.match(
    migration,
    /create or replace function public\.update_expense_with_participants[\s\S]*'equal',\s+null::integer\[\]/i,
  );
});
