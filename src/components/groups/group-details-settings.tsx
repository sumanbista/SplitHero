"use client";

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
import { Textarea } from "@/components/ui/textarea";
import {
  updateGroupDetails,
  type UpdateGroupDetailsState,
} from "@/lib/actions/groups";

const initialState: UpdateGroupDetailsState = {};

export function GroupDetailsSettings({
  shareToken,
  name,
  description,
}: {
  shareToken: string;
  name: string;
  description: string | null;
}) {
  const action = updateGroupDetails.bind(null, shareToken);
  const [state, formAction, pending] = useActionState(action, initialState);
  const nameError = state.fieldErrors?.name?.[0];
  const descriptionError = state.fieldErrors?.description?.[0];

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={Boolean(nameError)}>
          <FieldLabel htmlFor="group-name">Group name</FieldLabel>
          <Input
            id="group-name"
            name="name"
            defaultValue={name}
            maxLength={80}
            required
            autoComplete="off"
            aria-invalid={Boolean(nameError)}
          />
          <FieldError>{nameError}</FieldError>
        </Field>
        <Field data-invalid={Boolean(descriptionError)}>
          <FieldLabel htmlFor="group-description">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Textarea
            id="group-description"
            name="description"
            defaultValue={description ?? ""}
            maxLength={500}
            rows={4}
            placeholder="Add context about this group."
            aria-invalid={Boolean(descriptionError)}
          />
          <FieldError>{descriptionError}</FieldError>
        </Field>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save group details"}
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
