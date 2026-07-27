"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, MoreHorizontal, Pencil, Trash2, TriangleAlert } from "lucide-react";

import {
  ExpenseSplitFields,
} from "@/components/expenses/expense-split-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  deleteExpense,
  type DeleteExpenseState,
  updateExpense,
  type UpdateExpenseState,
} from "@/lib/actions/expenses";
import type { ExpenseListItem } from "@/components/expenses/expense-list";
import {
  calculateExpenseShares,
  parseCurrencyToCents,
  type ExpenseSplitMode,
} from "@/lib/calculations/expense-split";

type Member = {
  id: string;
  name: string;
};

type ExpenseActionsProps = {
  expense: ExpenseListItem;
  hasSettlementPayments: boolean;
  members: Member[];
  shareToken: string;
};

const initialUpdateState: UpdateExpenseState = {};
const initialDeleteState: DeleteExpenseState = {};

function formatCurrencyInput(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

function haveSameShares(
  left: Array<{ memberId: string; shareCents: number }>,
  right: Array<{ memberId: string; shareCents: number }>,
) {
  if (left.length !== right.length) {
    return false;
  }

  const rightShares = new Map(
    right.map((share) => [share.memberId, share.shareCents]),
  );
  return left.every(
    (share) => rightShares.get(share.memberId) === share.shareCents,
  );
}

function BalanceWarning({ hasSettlementPayments }: { hasSettlementPayments: boolean }) {
  return (
    <Alert>
      <TriangleAlert aria-hidden="true" />
      <AlertDescription>
        This will recalculate everyone’s balances and settlement recommendations.
        {hasSettlementPayments
          ? " Recorded payments will remain, so someone may owe money again or have a credit."
          : ""}
      </AlertDescription>
    </Alert>
  );
}

function EditExpenseDialog({
  expense,
  hasSettlementPayments,
  members,
  onOpenChange,
  onSuccess,
  shareToken,
}: ExpenseActionsProps & {
  onOpenChange: (open: boolean) => void;
  onSuccess: (message: string) => void;
}) {
  const initialParticipantIds = expense.participants.map(
    (participant) => participant.memberId,
  );
  const initialAmount = formatCurrencyInput(expense.amountCents);
  const initialParticipantValues = Object.fromEntries(
    expense.participants.map((participant) => [
      participant.memberId,
      expense.splitMode === "percentage"
        ? ((participant.percentageBasisPoints ?? 0) / 100).toFixed(2)
        : formatCurrencyInput(participant.shareCents),
    ]),
  );
  const [amount, setAmount] = useState(initialAmount);
  const [payerId, setPayerId] = useState(expense.paidByMemberId);
  const [participantIds, setParticipantIds] = useState(initialParticipantIds);
  const [splitMode, setSplitMode] = useState<ExpenseSplitMode>(
    expense.splitMode,
  );
  const [participantValues, setParticipantValues] = useState(
    initialParticipantValues,
  );
  const action = updateExpense.bind(null, shareToken);
  const [state, formAction, pending] = useActionState(action, initialUpdateState);
  const currentAmountCents = parseCurrencyToCents(amount);
  let currentShares: Array<{ memberId: string; shareCents: number }> | null =
    null;

  if (currentAmountCents !== null && currentAmountCents > 0) {
    try {
      currentShares = calculateExpenseShares(
        currentAmountCents,
        participantIds,
        splitMode,
        participantIds.map((memberId) => ({
          memberId,
          value: participantValues[memberId] ?? "",
        })),
      );
    } catch {
      currentShares = null;
    }
  }

  const financialChanged =
    currentAmountCents !== expense.amountCents ||
    payerId !== expense.paidByMemberId ||
    splitMode !== expense.splitMode ||
    currentShares === null ||
    !haveSameShares(currentShares, expense.participants);
  const payerItems = members.map((member) => ({
    label: member.name,
    value: member.id,
  }));

  useEffect(() => {
    if (!state.updatedExpenseId) {
      return;
    }

    onSuccess(`${state.expenseTitle ?? "Expense"} was updated.`);
    onOpenChange(false);
  }, [onOpenChange, onSuccess, state.expenseTitle, state.updatedExpenseId]);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit expense</DialogTitle>
          <DialogDescription>
            Update the expense details and equal split.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="expenseId" value={expense.id} />
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={expense.updatedAt}
          />
          <FieldGroup>
            <Field data-invalid={Boolean(state.fieldErrors?.title)}>
              <FieldLabel htmlFor={`expense-title-${expense.id}`}>
                Expense title
              </FieldLabel>
              <Input
                id={`expense-title-${expense.id}`}
                name="title"
                defaultValue={expense.title}
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
                <FieldLabel htmlFor={`expense-amount-${expense.id}`}>
                  Amount
                </FieldLabel>
                <Input
                  id={`expense-amount-${expense.id}`}
                  name="amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  required
                  autoComplete="off"
                  aria-invalid={Boolean(state.fieldErrors?.amount)}
                />
                <FieldError>{state.fieldErrors?.amount}</FieldError>
              </Field>

              <Field data-invalid={Boolean(state.fieldErrors?.paidByMemberId)}>
                <FieldLabel htmlFor={`expense-payer-${expense.id}`}>
                  Paid by
                </FieldLabel>
                <Select
                  name="paidByMemberId"
                  items={payerItems}
                  value={payerId}
                  onValueChange={(value) => setPayerId(value ?? "")}
                  required
                >
                  <SelectTrigger
                    id={`expense-payer-${expense.id}`}
                    className="h-12 w-full rounded-xl px-3.5"
                    aria-invalid={Boolean(state.fieldErrors?.paidByMemberId)}
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
              error={
                state.fieldErrors?.participantShares ??
                state.fieldErrors?.splitMode ??
                state.fieldErrors?.participantIds
              }
              idPrefix={`edit-expense-${expense.id}`}
              members={members}
              participantIds={participantIds}
              participantValues={participantValues}
              splitMode={splitMode}
              onParticipantIdsChange={setParticipantIds}
              onParticipantValuesChange={setParticipantValues}
              onSplitModeChange={setSplitMode}
            />

            <Field data-invalid={Boolean(state.fieldErrors?.expenseDate)}>
              <FieldLabel htmlFor={`expense-date-${expense.id}`}>Date</FieldLabel>
              <Input
                id={`expense-date-${expense.id}`}
                name="expenseDate"
                type="date"
                defaultValue={expense.expenseDate}
                aria-invalid={Boolean(state.fieldErrors?.expenseDate)}
              />
              <FieldError>{state.fieldErrors?.expenseDate}</FieldError>
            </Field>

            <Field data-invalid={Boolean(state.fieldErrors?.notes)}>
              <FieldLabel htmlFor={`expense-notes-${expense.id}`}>
                Notes <span className="text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Textarea
                id={`expense-notes-${expense.id}`}
                name="notes"
                defaultValue={expense.notes}
                maxLength={1000}
                aria-invalid={Boolean(state.fieldErrors?.notes)}
              />
              <FieldError>{state.fieldErrors?.notes}</FieldError>
            </Field>

            {financialChanged ? (
              <BalanceWarning hasSettlementPayments={hasSettlementPayments} />
            ) : null}

            {state.formError ? (
              <Alert variant="destructive">
                <AlertDescription>{state.formError}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteExpenseDialog({
  expense,
  hasSettlementPayments,
  onOpenChange,
  onSuccess,
  shareToken,
}: Omit<ExpenseActionsProps, "members"> & {
  onOpenChange: (open: boolean) => void;
  onSuccess: (message: string) => void;
}) {
  const action = deleteExpense.bind(null, shareToken);
  const [state, formAction, pending] = useActionState(action, initialDeleteState);

  useEffect(() => {
    if (!state.deletedExpenseId) {
      return;
    }

    onSuccess(`${expense.title} was deleted.`);
    onOpenChange(false);
  }, [expense.title, onOpenChange, onSuccess, state.deletedExpenseId]);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{expense.title}”?</DialogTitle>
          <DialogDescription>
            This expense and its participant shares will be permanently removed.
          </DialogDescription>
        </DialogHeader>
        <BalanceWarning hasSettlementPayments={hasSettlementPayments} />
        {state.formError ? (
          <Alert variant="destructive">
            <AlertDescription>{state.formError}</AlertDescription>
          </Alert>
        ) : null}
        <form action={formAction}>
          <input type="hidden" name="expenseId" value={expense.id} />
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={expense.updatedAt}
          />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              <Trash2 data-icon="inline-start" />
              {pending ? "Deleting…" : "Delete expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ExpenseActions(props: ExpenseActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>();

  function showSuccess(message: string) {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(undefined), 4000);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${props.expense.title}`}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil />
              Edit expense
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 />
              Delete expense
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {successMessage ? (
        <span className="sr-only" role="status">
          <CheckCircle2 aria-hidden="true" />
          {successMessage}
        </span>
      ) : null}
      {editOpen ? (
        <EditExpenseDialog
          {...props}
          onOpenChange={setEditOpen}
          onSuccess={showSuccess}
        />
      ) : null}
      {deleteOpen ? (
        <DeleteExpenseDialog
          {...props}
          onOpenChange={setDeleteOpen}
          onSuccess={showSuccess}
        />
      ) : null}
    </>
  );
}
