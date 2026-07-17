"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  type AuthActionState,
  requestPasswordReset,
} from "@/lib/actions/auth";

const initialState: AuthActionState = {};

export function PasswordResetRequestForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
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
        {state.success ? (
          <Alert className="border-primary/25 bg-primary-soft/40">
            <AlertDescription className="text-foreground" aria-live="polite">
              {state.success}
            </AlertDescription>
          </Alert>
        ) : null}
        <Field data-invalid={Boolean(state.fieldErrors?.email?.length)}>
          <FieldLabel htmlFor="reset-email">Email</FieldLabel>
          <Input
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            required
            autoFocus
            aria-invalid={Boolean(state.fieldErrors?.email?.length)}
          />
          <FieldError
            errors={state.fieldErrors?.email?.map((message) => ({ message }))}
          />
        </Field>
        <Button type="submit" size="xl" disabled={pending}>
          {pending ? "Sending reset link…" : "Send reset link"}
        </Button>
      </FieldGroup>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered your password?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
