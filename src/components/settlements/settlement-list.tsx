"use client";

import { useActionState } from "react";
import { ArrowRight, CircleCheck, HandCoins } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import {
  recordSettlementPayment,
  type RecordSettlementState,
} from "@/lib/actions/settlements";
import { formatCurrencyFromCents } from "@/lib/utils/currency";

export type SettlementListItem = {
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amountCents: number;
};

type SettlementListProps = {
  shareToken: string;
  settlements: SettlementListItem[];
  hasExpenses: boolean;
};

const initialState: RecordSettlementState = {};

function SettlementPaymentForm({
  shareToken,
  settlement,
}: {
  shareToken: string;
  settlement: SettlementListItem;
}) {
  const action = recordSettlementPayment.bind(null, shareToken);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col items-stretch gap-3 sm:items-end">
      <input
        type="hidden"
        name="fromMemberId"
        value={settlement.fromMemberId}
      />
      <input type="hidden" name="toMemberId" value={settlement.toMemberId} />
      <input
        type="hidden"
        name="amountCents"
        value={settlement.amountCents}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Recording…" : "Record payment"}
      </Button>
      {state.formError ? (
        <Alert variant="destructive" className="sm:max-w-xs">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}

export function SettlementList({
  shareToken,
  settlements,
  hasExpenses,
}: SettlementListProps) {
  if (settlements.length === 0) {
    return (
      <Empty className="border bg-primary-soft/40 py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {hasExpenses ? <CircleCheck /> : <HandCoins />}
          </EmptyMedia>
          <EmptyTitle>
            {hasExpenses ? "Everyone is settled" : "No payments needed yet"}
          </EmptyTitle>
          <EmptyDescription>
            {hasExpenses
              ? "There are no outstanding payments in this group."
              : "Add an expense to see who should pay whom."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul aria-label="Recommended payments" className="flex flex-col">
      {settlements.map((settlement, index) => (
        <li
          key={`${settlement.fromMemberId}-${settlement.toMemberId}`}
        >
          {index > 0 ? <Separator /> : null}
          <article className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold">
                <span className="truncate">{settlement.fromMemberName}</span>
                <ArrowRight aria-hidden="true" />
                <span className="truncate">{settlement.toMemberName}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {settlement.fromMemberName} pays {settlement.toMemberName}
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums">
                {formatCurrencyFromCents(settlement.amountCents)}
              </p>
            </div>
            <SettlementPaymentForm
              shareToken={shareToken}
              settlement={settlement}
            />
          </article>
        </li>
      ))}
    </ul>
  );
}
