"use client";

import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

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
import {
  permanentlyDeleteGroup,
  updateGroupLifecycle,
  type DeleteGroupState,
  type GroupLifecycleState,
} from "@/lib/actions/groups";
import { cn } from "@/lib/utils";

const initialLifecycleState: GroupLifecycleState = {};
const initialDeleteState: DeleteGroupState = {};

export function GroupLifecycleSettings({
  shareToken,
  groupName,
  isArchived,
  compact = false,
}: {
  shareToken: string;
  groupName: string;
  isArchived: boolean;
  compact?: boolean;
}) {
  const lifecycleAction = updateGroupLifecycle.bind(null, shareToken);
  const deleteAction = permanentlyDeleteGroup.bind(null, shareToken);
  const [lifecycleState, lifecycleFormAction, lifecyclePending] =
    useActionState(lifecycleAction, initialLifecycleState);
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteAction,
    initialDeleteState,
  );
  const [confirmationName, setConfirmationName] = useState("");

  if (!isArchived) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-medium">Archive group</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Keep the complete history while making the group read-only for
            everyone. You can restore it later.
          </p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>
            <Archive data-icon="inline-start" />
            Archive group
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive {groupName}?</DialogTitle>
              <DialogDescription>
                Members can still view the group, but nobody will be able to
                change expenses, payments, people, invitations, or settings.
              </DialogDescription>
            </DialogHeader>
            <form action={lifecycleFormAction}>
              <input type="hidden" name="intent" value="archive" />
              <DialogFooter>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={lifecyclePending}
                >
                  <Archive data-icon="inline-start" />
                  {lifecyclePending ? "Archiving…" : "Archive group"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {lifecycleState.formError ? (
          <Alert variant="destructive">
            <AlertDescription>{lifecycleState.formError}</AlertDescription>
          </Alert>
        ) : lifecycleState.successMessage ? (
          <Alert>
            <AlertDescription>{lifecycleState.successMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", compact ? "gap-3" : "gap-6")}>
      <div className="flex flex-col gap-3">
        {compact ? null : (
          <div>
            <p className="font-medium">Restore group</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Re-enable the group with the same access, roles, people, expenses,
              settlements, and history.
            </p>
          </div>
        )}
        <form action={lifecycleFormAction}>
          <input type="hidden" name="intent" value="restore" />
          <Button
            type="submit"
            variant="outline"
            className={cn(compact && "w-full")}
            disabled={lifecyclePending}
          >
            <RotateCcw data-icon="inline-start" />
            {lifecyclePending ? "Restoring…" : "Restore group"}
          </Button>
        </form>
      </div>

      {lifecycleState.formError ? (
        <Alert variant="destructive">
          <AlertDescription>{lifecycleState.formError}</AlertDescription>
        </Alert>
      ) : lifecycleState.successMessage ? (
        <Alert>
          <AlertDescription>{lifecycleState.successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3">
        {compact ? null : (
          <div>
            <p className="font-medium text-destructive">Permanently delete</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Erase every member, expense, split, settlement, invitation, and
              activity entry. This cannot be undone.
            </p>
          </div>
        )}
        <Dialog>
          <DialogTrigger
            render={
              <Button
                variant="destructive"
                className={cn(compact && "w-full")}
              />
            }
          >
            <Trash2 data-icon="inline-start" />
            Permanently delete
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Permanently delete {groupName}?</DialogTitle>
              <DialogDescription>
                This erases the complete group and its history for everyone.
                Enter the group name exactly to confirm.
              </DialogDescription>
            </DialogHeader>
            <form action={deleteFormAction}>
              <FieldGroup>
                <Field data-invalid={Boolean(deleteState.confirmationError)}>
                  <FieldLabel htmlFor="delete-group-confirmation">
                    Enter {groupName}
                  </FieldLabel>
                  <Input
                    id="delete-group-confirmation"
                    name="confirmationName"
                    value={confirmationName}
                    onChange={(event) =>
                      setConfirmationName(event.currentTarget.value)
                    }
                    autoComplete="off"
                    aria-invalid={Boolean(deleteState.confirmationError)}
                  />
                  <FieldError>{deleteState.confirmationError}</FieldError>
                </Field>
                {deleteState.formError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{deleteState.formError}</AlertDescription>
                  </Alert>
                ) : null}
                <DialogFooter>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={
                      deletePending || confirmationName.trim() !== groupName
                    }
                  >
                    <Trash2 data-icon="inline-start" />
                    {deletePending ? "Deleting…" : "Delete permanently"}
                  </Button>
                </DialogFooter>
              </FieldGroup>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
