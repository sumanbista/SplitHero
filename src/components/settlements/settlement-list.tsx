"use client";

import { useActionState } from "react";
import { ArrowRight, CircleCheck, HandCoins } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
  canRecord?: boolean;
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
    <form action={formAction} className="flex w-full flex-col gap-3">
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
      <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:self-end">
        {pending ? "Recording…" : "Record payment"}
      </Button>
      {state.formError ? (
        <Alert variant="destructive">
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
  canRecord = true,
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
    <ul aria-label="Recommended payments" className="flex flex-col gap-3">
      {settlements.map((settlement) => (
        <li
          key={`${settlement.fromMemberId}-${settlement.toMemberId}`}
        >
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="truncate">{settlement.fromMemberName}</span>
                <ArrowRight aria-hidden="true" />
                <span className="truncate">{settlement.toMemberName}</span>
              </CardTitle>
              <CardDescription>
                {settlement.fromMemberName} pays {settlement.toMemberName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {formatCurrencyFromCents(settlement.amountCents)}
              </p>
            </CardContent>
            {canRecord ? (
              <CardFooter>
                <SettlementPaymentForm
                  shareToken={shareToken}
                  settlement={settlement}
                />
              </CardFooter>
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}
