"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, Plus } from "lucide-react";

import {
  ExpenseSplitFields,
} from "@/components/expenses/expense-split-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addExpense } from "@/lib/actions/expenses";
import type { AddExpenseState } from "@/lib/actions/expenses";
import type { ExpenseSplitMode } from "@/lib/calculations/expense-split";

const initialAddExpenseState: AddExpenseState = {};

type Member = {
  id: string;
  name: string;
};

type AddExpenseDialogProps = {
  shareToken: string;
  members: Member[];
};

export function AddExpenseDialog({
  shareToken,
  members,
}: AddExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>();
  const [amount, setAmount] = useState("");
  const [splitMode, setSplitMode] = useState<ExpenseSplitMode>("equal");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [participantValues, setParticipantValues] = useState<
    Record<string, string>
  >({});
  const handledExpenseId = useRef<string | undefined>(undefined);
  const addExpenseForGroup = addExpense.bind(null, shareToken);
  const [state, formAction, pending] = useActionState(
    addExpenseForGroup,
    initialAddExpenseState,
  );

  useEffect(() => {
    if (!state.expenseId || handledExpenseId.current === state.expenseId) {
      return;
    }

    handledExpenseId.current = state.expenseId;
    setOpen(false);
    setAmount("");
    setSplitMode("equal");
    setParticipantIds([]);
    setParticipantValues({});
    setSuccessMessage(`${state.expenseTitle} was added.`);

    const timeout = window.setTimeout(() => setSuccessMessage(undefined), 4000);
    return () => window.clearTimeout(timeout);
  }, [state.expenseId, state.expenseTitle]);

  const payerItems = members.map((member) => ({
    label: member.name,
    value: member.id,
  }));
  const participantError = state.fieldErrors?.participantIds;
  const splitError =
    state.fieldErrors?.participantShares ??
    state.fieldErrors?.splitMode ??
    participantError;

  return (
    <div className="flex flex-col items-stretch gap-3 sm:items-end">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button
              size="lg"
              disabled={members.length === 0}
              title={members.length === 0 ? "Add a member first" : undefined}
            />
          }
        >
          <Plus data-icon="inline-start" />
          Add expense
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add an expense</DialogTitle>
            <DialogDescription>
              Record who paid and who shared this expense.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction}>
            <FieldGroup>
              <Field data-invalid={Boolean(state.fieldErrors?.title)}>
                <FieldLabel htmlFor="expense-title">Expense title</FieldLabel>
                <Input
                  id="expense-title"
                  name="title"
                  placeholder="Dinner"
                  maxLength={100}
                  required
                  autoComplete="off"
                  autoFocus
                  aria-invalid={Boolean(state.fieldErrors?.title)}
                />
                <FieldError>{state.fieldErrors?.title}</FieldError>
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field data-invalid={Boolean(state.fieldErrors?.amount)}>
                  <FieldLabel htmlFor="expense-amount">Amount</FieldLabel>
                  <Input
                    id="expense-amount"
                    name="amount"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    inputMode="decimal"
                    placeholder="90.00"
                    required
                    autoComplete="off"
                    aria-invalid={Boolean(state.fieldErrors?.amount)}
                  />
                  <FieldError>{state.fieldErrors?.amount}</FieldError>
                </Field>

                <Field
                  data-invalid={Boolean(state.fieldErrors?.paidByMemberId)}
                >
                  <FieldLabel htmlFor="expense-payer">Paid by</FieldLabel>
                  <Select
                    name="paidByMemberId"
                    items={payerItems}
                    required
                  >
                    <SelectTrigger
                      id="expense-payer"
                      className="h-12 w-full rounded-xl px-3.5"
                      aria-invalid={Boolean(
                        state.fieldErrors?.paidByMemberId,
                      )}
                    >
                      <SelectValue placeholder="Select a payer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {payerItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError>{state.fieldErrors?.paidByMemberId}</FieldError>
                </Field>
              </div>

              <ExpenseSplitFields
                amount={amount}
                error={splitError}
                idPrefix="add-expense"
                members={members}
                participantIds={participantIds}
                participantValues={participantValues}
                splitMode={splitMode}
                onParticipantIdsChange={setParticipantIds}
                onParticipantValuesChange={setParticipantValues}
                onSplitModeChange={setSplitMode}
              />

              <Field data-invalid={Boolean(state.fieldErrors?.expenseDate)}>
                <FieldLabel htmlFor="expense-date">
                  Date <span className="text-muted-foreground">(optional)</span>
                </FieldLabel>
                <Input
                  id="expense-date"
                  name="expenseDate"
                  type="date"
                  aria-invalid={Boolean(state.fieldErrors?.expenseDate)}
                />
                <FieldError>{state.fieldErrors?.expenseDate}</FieldError>
              </Field>

              <Field data-invalid={Boolean(state.fieldErrors?.notes)}>
                <FieldLabel htmlFor="expense-notes">
                  Notes <span className="text-muted-foreground">(optional)</span>
                </FieldLabel>
                <Textarea
                  id="expense-notes"
                  name="notes"
                  placeholder="Add a helpful detail"
                  maxLength={1000}
                  aria-invalid={Boolean(state.fieldErrors?.notes)}
                />
                <FieldError>{state.fieldErrors?.notes}</FieldError>
              </Field>

              {state.formError ? (
                <Alert variant="destructive">
                  <AlertDescription>{state.formError}</AlertDescription>
                </Alert>
              ) : null}

              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Adding expense…" : "Add expense"}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
      {successMessage ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm font-medium text-success"
        >
          <CheckCircle2 className="size-4" />
          {successMessage}
        </p>
      ) : null}
    </div>
  );
}
