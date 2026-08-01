"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, CircleCheck, HandCoins } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  recordSettlementPayment,
  type RecordSettlementState,
} from "@/lib/actions/settlements";
import { parseCurrencyToCents } from "@/lib/calculations/expense-split";
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
  const recommendedAmount = (settlement.amountCents / 100).toFixed(2);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(recommendedAmount);
  const handledPaymentId = useRef<string | undefined>(undefined);
  const action = recordSettlementPayment.bind(null, shareToken);
  const [state, formAction, pending] = useActionState(action, initialState);
  const amountCents = parseCurrencyToCents(amount);
  const amountError =
    amountCents === null || amountCents <= 0
      ? "Enter an amount greater than $0.00."
      : amountCents > settlement.amountCents
        ? `Enter no more than ${formatCurrencyFromCents(settlement.amountCents)}.`
        : undefined;

  useEffect(() => {
    if (!state.paymentId || handledPaymentId.current === state.paymentId) {
      return;
    }

    handledPaymentId.current = state.paymentId;
    setOpen(false);
  }, [state.paymentId]);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setAmount(recommendedAmount);
    }
    setOpen(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" />}>
        Record payment
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Confirm who paid and edit the amount if only part of the balance was
            settled.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 p-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{settlement.fromMemberName}</p>
            <p className="text-xs text-muted-foreground">Paid by</p>
          </div>
          <ArrowRight
            aria-hidden="true"
            className="shrink-0 text-muted-foreground"
          />
          <div className="min-w-0 text-right">
            <p className="truncate font-medium">{settlement.toMemberName}</p>
            <p className="text-xs text-muted-foreground">Received by</p>
          </div>
        </div>

        <form action={formAction}>
          <input
            type="hidden"
            name="fromMemberId"
            value={settlement.fromMemberId}
          />
          <input type="hidden" name="toMemberId" value={settlement.toMemberId} />
          <input type="hidden" name="amountCents" value={amountCents ?? ""} />

          <Field data-invalid={Boolean(amountError)}>
            <FieldLabel
              htmlFor={`settlement-amount-${settlement.fromMemberId}-${settlement.toMemberId}`}
            >
              Payment amount
            </FieldLabel>
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted-foreground"
              >
                $
              </span>
              <Input
                id={`settlement-amount-${settlement.fromMemberId}-${settlement.toMemberId}`}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                className="pl-7 tabular-nums"
                aria-invalid={Boolean(amountError)}
                autoFocus
                required
              />
            </div>
            <FieldDescription>
              Up to {formatCurrencyFromCents(settlement.amountCents)} can be
              recorded now.
            </FieldDescription>
            <FieldError>{amountError}</FieldError>
          </Field>

          {state.formError ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{state.formError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="mt-4">
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending || Boolean(amountError)}>
              {pending ? "Recording…" : "Confirm payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
            <CardHeader className="grid-cols-1 grid-rows-none gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <span className="truncate">{settlement.fromMemberName}</span>
                  <ArrowRight aria-hidden="true" />
                  <span className="truncate">{settlement.toMemberName}</span>
                </CardTitle>
                <CardDescription className="mt-1">
                  {settlement.fromMemberName} pays {settlement.toMemberName}
                </CardDescription>
              </div>
              <CardAction className="col-start-1 row-start-auto flex w-full items-center justify-between gap-3 sm:col-start-2 sm:row-start-1 sm:w-auto sm:self-center">
                <p className="shrink-0 text-xl font-semibold tabular-nums">
                  {formatCurrencyFromCents(settlement.amountCents)}
                </p>
                {canRecord ? (
                  <SettlementPaymentForm
                    shareToken={shareToken}
                    settlement={settlement}
                  />
                ) : null}
              </CardAction>
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  );
}
