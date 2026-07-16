import { z } from "zod";

const positiveCentsSchema = z
  .string()
  .regex(/^\d+$/, "Choose a valid settlement recommendation.")
  .transform(Number)
  .refine(
    (value) => Number.isSafeInteger(value) && value > 0,
    "Choose a valid settlement recommendation.",
  );

export const recordSettlementSchema = z
  .object({
    fromMemberId: z.uuid("Choose a valid settlement recommendation."),
    toMemberId: z.uuid("Choose a valid settlement recommendation."),
    amountCents: positiveCentsSchema,
  })
  .refine((input) => input.fromMemberId !== input.toMemberId, {
    message: "A member cannot pay themselves.",
  });
