"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  type AuthActionState,
  login,
  signup,
} from "@/lib/actions/auth";
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

const initialState: AuthActionState = {};

type AuthFormProps = {
  mode: "login" | "signup";
  nextPath?: string;
};

export function AuthForm({ mode, nextPath }: AuthFormProps) {
  const isLogin = mode === "login";
  const [state, formAction, pending] = useActionState(
    isLogin ? login : signup,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <FieldGroup>
        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state.success ? (
          <Alert className="border-primary/25 bg-primary-soft/40">
            <AlertDescription className="text-foreground">
              {state.success}
            </AlertDescription>
          </Alert>
        ) : null}
        <Field data-invalid={Boolean(state.fieldErrors?.email?.length)}>
          <FieldLabel htmlFor={`${mode}-email`}>Email</FieldLabel>
          <Input
            id={`${mode}-email`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            aria-invalid={Boolean(state.fieldErrors?.email?.length)}
          />
          <FieldError
            errors={state.fieldErrors?.email?.map((message) => ({ message }))}
          />
        </Field>
        <Field data-invalid={Boolean(state.fieldErrors?.password?.length)}>
          <FieldLabel htmlFor={`${mode}-password`}>Password</FieldLabel>
          <Input
            id={`${mode}-password`}
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={8}
            aria-invalid={Boolean(state.fieldErrors?.password?.length)}
          />
          {isLogin ? null : (
            <FieldDescription>Use at least 8 characters.</FieldDescription>
          )}
          <FieldError
            errors={state.fieldErrors?.password?.map((message) => ({ message }))}
          />
        </Field>
        <Button type="submit" size="xl" disabled={pending}>
          {pending
            ? isLogin
              ? "Logging in…"
              : "Creating account…"
            : isLogin
              ? "Log in"
              : "Create account"}
        </Button>
      </FieldGroup>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isLogin ? "New to SplitHero?" : "Already have an account?"}{" "}
        <Link
          href={isLogin ? "/signup" : "/login"}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          {isLogin ? "Create an account" : "Log in"}
        </Link>
      </p>
    </form>
  );
}
