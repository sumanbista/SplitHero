"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  type ProfileActionState,
  updateDisplayName,
} from "@/lib/actions/auth";

const initialState: ProfileActionState = {};

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, formAction, pending] = useActionState(
    updateDisplayName,
    initialState,
  );

  return (
    <form action={formAction}>
      <FieldGroup>
        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription aria-live="polite">{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state.success ? (
          <Alert className="border-primary/25 bg-primary-soft/40">
            <AlertDescription className="text-foreground" aria-live="polite">
              {state.success}
            </AlertDescription>
          </Alert>
        ) : null}
        <Field data-invalid={Boolean(state.fieldErrors?.displayName?.length)}>
          <FieldLabel htmlFor="display-name">Display name</FieldLabel>
          <Input
            id="display-name"
            name="displayName"
            type="text"
            autoComplete="name"
            defaultValue={displayName}
            required
            maxLength={80}
            aria-invalid={Boolean(state.fieldErrors?.displayName?.length)}
          />
          <FieldDescription>
            This name appears in your account menu and dashboard.
          </FieldDescription>
          <FieldError
            errors={state.fieldErrors?.displayName?.map((message) => ({ message }))}
          />
        </Field>
        <Button type="submit" size="xl" disabled={pending}>
          {pending ? "Saving…" : "Save display name"}
        </Button>
      </FieldGroup>
    </form>
  );
}
