"use client";

import Link from "next/link";
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
import { type AuthActionState, updatePassword } from "@/lib/actions/auth";

const initialState: AuthActionState = {};

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    initialState,
  );

  return (
    <form action={formAction} className="mt-6">
      <FieldGroup>
        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription aria-live="polite">{state.error}</AlertDescription>
          </Alert>
        ) : null}
        <Field data-invalid={Boolean(state.fieldErrors?.password?.length)}>
          <FieldLabel htmlFor="new-password">New password</FieldLabel>
          <Input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            autoFocus
            aria-invalid={Boolean(state.fieldErrors?.password?.length)}
          />
          <FieldDescription>Use 8–72 characters.</FieldDescription>
          <FieldError
            errors={state.fieldErrors?.password?.map((message) => ({ message }))}
          />
        </Field>
        <Field data-invalid={Boolean(state.fieldErrors?.confirmPassword?.length)}>
          <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
          <Input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            aria-invalid={Boolean(state.fieldErrors?.confirmPassword?.length)}
          />
          <FieldError
            errors={state.fieldErrors?.confirmPassword?.map((message) => ({ message }))}
          />
        </Field>
        <Button type="submit" size="xl" disabled={pending}>
          {pending ? "Updating password…" : "Update password"}
        </Button>
      </FieldGroup>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Need a new link?{" "}
        <Link
          href="/forgot-password"
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          Request another
        </Link>
      </p>
    </form>
  );
}
