import assert from "node:assert/strict";
import test from "node:test";

import { recordSettlementSchema } from "../src/lib/validations/settlement.ts";

const validSettlement = {
  fromMemberId: "00000000-0000-4000-8000-000000000001",
  toMemberId: "00000000-0000-4000-8000-000000000002",
  amountCents: "1850",
};

test("settlement validation converts positive integer cents", () => {
  assert.deepEqual(recordSettlementSchema.parse(validSettlement), {
    ...validSettlement,
    amountCents: 1850,
  });
});

test("settlement validation rejects invalid cents and member ids", () => {
  assert.equal(
    recordSettlementSchema.safeParse({
      ...validSettlement,
      amountCents: "18.50",
    }).success,
    false,
  );
  assert.equal(
    recordSettlementSchema.safeParse({
      ...validSettlement,
      fromMemberId: "not-a-member",
    }).success,
    false,
  );
});

test("settlement validation rejects self-payments", () => {
  assert.equal(
    recordSettlementSchema.safeParse({
      ...validSettlement,
      toMemberId: validSettlement.fromMemberId,
    }).success,
    false,
  );
});
