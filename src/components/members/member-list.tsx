"use client";

import { useActionState, useState } from "react";
import { Archive, RotateCcw, Settings2, Trash2, Users } from "lucide-react";

import { MemberAvatar } from "@/components/members/member-avatar";
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  mutateMember,
  type MemberMutationState,
} from "@/lib/actions/members";
import { formatCurrencyFromCents } from "@/lib/utils/currency";

export type MemberSummary = {
  id: string;
  name: string;
  isActive: boolean;
  isAccountLinked: boolean;
  balanceCents: number;
  totalPaidCents: number;
  totalShareCents: number;
  paidExpenseCount: number;
  participatedExpenseCount: number;
  sentPaymentCents: number;
  receivedPaymentCents: number;
};

type MemberListProps = {
  members: MemberSummary[];
  shareToken: string;
  canManage: boolean;
};

const initialMutationState: MemberMutationState = {};

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function MemberManager({
  canManage,
  member,
  shareToken,
}: {
  canManage: boolean;
  member: MemberSummary;
  shareToken: string;
}) {
  const [open, setOpen] = useState(false);
  const action = mutateMember.bind(null, shareToken);
  const [state, formAction, pending] = useActionState(
    action,
    initialMutationState,
  );
  const hasFinancialHistory =
    member.paidExpenseCount > 0 ||
    member.participatedExpenseCount > 0 ||
    member.sentPaymentCents > 0 ||
    member.receivedPaymentCents > 0;
  const canRemovePermanently =
    !member.isAccountLinked &&
    !hasFinancialHistory &&
    member.balanceCents === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${canManage ? "Manage" : "View"} ${member.name}`}
          />
        }
      >
        <Settings2 />
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{member.name}</DialogTitle>
          <DialogDescription>
            Review this member’s group-specific activity and status.
          </DialogDescription>
        </DialogHeader>

        <dl className="flex flex-col gap-2 rounded-lg bg-muted/50 p-4">
          <SummaryValue
            label="Current balance"
            value={formatCurrencyFromCents(member.balanceCents)}
          />
          <SummaryValue
            label="Paid"
            value={formatCurrencyFromCents(member.totalPaidCents)}
          />
          <SummaryValue
            label="Expense shares"
            value={formatCurrencyFromCents(member.totalShareCents)}
          />
          <SummaryValue
            label="Expenses paid"
            value={member.paidExpenseCount.toString()}
          />
          <SummaryValue
            label="Expenses joined"
            value={member.participatedExpenseCount.toString()}
          />
          <SummaryValue
            label="Payments sent"
            value={formatCurrencyFromCents(member.sentPaymentCents)}
          />
          <SummaryValue
            label="Payments received"
            value={formatCurrencyFromCents(member.receivedPaymentCents)}
          />
          {canManage ? (
            <SummaryValue
              label="Account"
              value={member.isAccountLinked ? "Connected" : "Guest member"}
            />
          ) : null}
        </dl>

        {state.formError && state.memberId === member.id ? (
          <Alert variant="destructive">
            <AlertDescription>{state.formError}</AlertDescription>
          </Alert>
        ) : null}
        {state.result && state.memberId === member.id ? (
          <Alert>
            <AlertDescription className="capitalize">
              Member {state.result}.
            </AlertDescription>
          </Alert>
        ) : null}
        {canManage ? (
          <>
            <form action={formAction}>
              <input type="hidden" name="intent" value="rename" />
              <input type="hidden" name="memberId" value={member.id} />
              <FieldGroup>
                <Field
                  data-invalid={Boolean(
                   state.fieldError && state.memberId === member.id,
                  )}
                >
                  <FieldLabel htmlFor={`member-name-${member.id}`}>
                    Group-local name
                  </FieldLabel>
                  <Input
                    id={`member-name-${member.id}`}
                    name="name"
                    defaultValue={member.name}
                    maxLength={50}
                    required
                    autoComplete="off"
                    aria-invalid={Boolean(
                      state.fieldError && state.memberId === member.id,
                    )}
                  />
                  <FieldError>
                    {state.memberId === member.id
                      ? state.fieldError
                      : undefined}
                  </FieldError>
                </Field>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save name"}
                </Button>
              </FieldGroup>
            </form>

            <Separator />

            <div className="flex flex-col gap-3">
              <div>
                <p className="font-medium">
                  {member.isActive ? "Archive member" : "Restore member"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {member.isActive
                    ? "Keeps all history and account access, but removes this person from new expense choices."
                    : "Makes this person available for new expenses again."}
                </p>
              </div>
              <form action={formAction}>
                <input
                  type="hidden"
                  name="intent"
                  value={member.isActive ? "archive" : "restore"}
                />
                <input type="hidden" name="memberId" value={member.id} />
                <Button type="submit" variant="outline" disabled={pending}>
                  {member.isActive ? (
                    <Archive data-icon="inline-start" />
                  ) : (
                    <RotateCcw data-icon="inline-start" />
                  )}
                  {member.isActive ? "Archive member" : "Restore member"}
                </Button>
              </form>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <div>
                <p className="font-medium">Remove permanently</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Only unused guest members can be deleted. Members with
                  accounts, invitations, expenses, payments, or balances must
                  be archived.
                </p>
              </div>
              <form action={formAction}>
                <input type="hidden" name="intent" value="remove" />
                <input type="hidden" name="memberId" value={member.id} />
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={pending || !canRemovePermanently}
                  title={
                    canRemovePermanently
                      ? undefined
                      : "Archive this member to preserve their account or group history."
                  }
                >
                  <Trash2 data-icon="inline-start" />
                  Remove permanently
                </Button>
              </form>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function MemberList({
  members,
  shareToken,
  canManage,
}: MemberListProps) {
  if (members.length === 0) {
    return (
      <Empty className="border bg-primary-soft/40 py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>No members yet</EmptyTitle>
          <EmptyDescription>
            Add the people who will share expenses in this group.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const activeMembers = members.filter((member) => member.isActive);
  const archivedMembers = members.filter((member) => !member.isActive);

  return (
    <div className="flex flex-col gap-5">
      {[
        { label: "Active", members: activeMembers },
        { label: "Archived", members: archivedMembers },
      ].map((section) =>
        section.members.length > 0 ? (
          <section key={section.label} aria-label={`${section.label} members`}>
            {archivedMembers.length > 0 ? (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.label}
              </p>
            ) : null}
            <ul className="flex flex-col">
              {section.members.map((member, index) => (
                <li key={member.id}>
                  {index > 0 ? <Separator /> : null}
                  <div className="flex items-center gap-3 py-3">
                    <MemberAvatar name={member.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{member.name}</p>
                      {!member.isActive ? (
                        <p className="text-xs text-muted-foreground">
                          Archived
                        </p>
                      ) : null}
                    </div>
                    <MemberManager
                      canManage={canManage}
                      member={member}
                      shareToken={shareToken}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
