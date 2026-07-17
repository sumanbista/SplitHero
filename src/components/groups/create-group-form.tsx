"use client";

import { useActionState } from "react";

import { createGroup } from "@/lib/actions/groups";
import type { CreateGroupState } from "@/lib/actions/groups";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const initialCreateGroupState: CreateGroupState = {};

type CreateGroupFormProps = {
  isAuthenticated?: boolean;
};

export function CreateGroupForm({
  isAuthenticated = false,
}: CreateGroupFormProps) {
  const [state, formAction, pending] = useActionState(
    createGroup,
    initialCreateGroupState,
  );

  return (
    <form action={formAction} id="create-group" className="scroll-mt-24">
      <Card className="gap-0 py-0 shadow-[0_18px_50px_rgba(23,33,29,0.06)] sm:min-h-[26rem]">
        <CardHeader className="gap-2 px-6 pt-7 pb-5 sm:px-10 sm:pt-10 sm:pb-7">
          <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
            <h2>Create a group</h2>
          </CardTitle>
          <CardDescription>
            Start with a name everyone will recognize.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 px-6 pb-6 sm:px-10 sm:pb-10">
          <FieldGroup>
            <Field data-invalid={Boolean(state.fieldError)}>
              <FieldLabel htmlFor="group-name">Group name</FieldLabel>
              <Input
                id="group-name"
                name="name"
                placeholder="Boston Trip"
                defaultValue={state.value}
                maxLength={80}
                required
                autoComplete="off"
                aria-invalid={Boolean(state.fieldError)}
                aria-describedby={
                  state.fieldError ? "group-name-error" : undefined
                }
              />
              <FieldError id="group-name-error">
                {state.fieldError}
              </FieldError>
            </Field>
            <Button type="submit" size="xl" disabled={pending}>
              {pending ? "Creating group…" : "Create group"}
            </Button>
            {state.formError ? (
              <p role="alert" className="text-sm text-destructive">
                {state.formError}
              </p>
            ) : null}
          </FieldGroup>
        </CardContent>
        <CardFooter className="border-t border-border bg-muted/40 px-6 py-4 sm:px-10 sm:py-6">
          <p className="text-sm text-muted-foreground">
            {isAuthenticated
              ? "This group will be saved to your dashboard. Its share link still works for everyone."
              : "No account needed. Share the link with your group."}
          </p>
        </CardFooter>
      </Card>
    </form>
  );
}
