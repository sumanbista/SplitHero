"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, Plus } from "lucide-react";

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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { addMember } from "@/lib/actions/members";
import type { AddMemberState } from "@/lib/actions/members";

const initialAddMemberState: AddMemberState = {};

type AddMemberDialogProps = {
  shareToken: string;
};

export function AddMemberDialog({ shareToken }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>();
  const handledMemberId = useRef<string | undefined>(undefined);
  const addMemberForGroup = addMember.bind(null, shareToken);
  const [state, formAction, pending] = useActionState(
    addMemberForGroup,
    initialAddMemberState,
  );

  useEffect(() => {
    if (!state.memberId || handledMemberId.current === state.memberId) {
      return;
    }

    handledMemberId.current = state.memberId;
    setOpen(false);
    setSuccessMessage(`${state.memberName} was added.`);

    const timeout = window.setTimeout(() => setSuccessMessage(undefined), 4000);

    return () => window.clearTimeout(timeout);
  }, [state.memberId, state.memberName]);

  return (
    <div className="flex flex-col items-stretch gap-3 sm:items-end">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button size="lg" />}>
          <Plus data-icon="inline-start" />
          Add member
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a member</DialogTitle>
            <DialogDescription>
              Enter the name they use in this group.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction}>
            <FieldGroup>
              <Field data-invalid={Boolean(state.fieldError)}>
                <FieldLabel htmlFor="member-name">Member name</FieldLabel>
                <Input
                  id="member-name"
                  name="name"
                  placeholder="Alex"
                  defaultValue={state.value}
                  maxLength={50}
                  required
                  autoComplete="off"
                  autoFocus
                  aria-invalid={Boolean(state.fieldError)}
                  aria-describedby={
                    state.fieldError ? "member-name-error" : undefined
                  }
                />
                <FieldError id="member-name-error">
                  {state.fieldError}
                </FieldError>
              </Field>
              {state.formError ? (
                <Alert variant="destructive">
                  <AlertDescription>{state.formError}</AlertDescription>
                </Alert>
              ) : null}
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Adding member…" : "Add member"}
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
