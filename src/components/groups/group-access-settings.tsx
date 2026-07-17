"use client";

import { LockKeyhole, Link2 } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateGroupAccess,
  type UpdateGroupAccessState,
} from "@/lib/actions/groups";
import type { GroupAccessMode } from "@/lib/groups/permissions";

const initialState: UpdateGroupAccessState = {};

export function GroupAccessSettings({
  shareToken,
  accessMode,
}: {
  shareToken: string;
  accessMode: GroupAccessMode;
}) {
  const action = updateGroupAccess.bind(null, shareToken);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="group-access-mode">Who can open this group?</FieldLabel>
          <Select name="accessMode" defaultValue={accessMode}>
            <SelectTrigger id="group-access-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">
                <Link2 /> Anyone with the link
              </SelectItem>
              <SelectItem value="private">
                <LockKeyhole /> Invited members only
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs leading-5 text-muted-foreground">
            Public links keep guest mode available. Private groups require a
            SplitHero account connected by invitation.
          </p>
        </Field>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save access setting"}
        </Button>
      </FieldGroup>
      {state.formError ? (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      ) : state.successMessage ? (
        <Alert className="border-primary/25 bg-primary-soft/40">
          <AlertDescription className="text-foreground">
            {state.successMessage}
          </AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
