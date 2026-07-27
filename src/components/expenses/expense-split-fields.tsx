"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { calculateEqualShares } from "@/lib/calculations/equal-split";
import {
  parseCurrencyToCents,
  parsePercentageToBasisPoints,
  type ExpenseSplitMode,
} from "@/lib/calculations/expense-split";
import { formatCurrencyFromCents } from "@/lib/utils/currency";

type Member = {
  id: string;
  name: string;
};

type ExpenseSplitFieldsProps = {
  amount: string;
  error?: string;
  idPrefix: string;
  members: Member[];
  participantIds: string[];
  participantValues: Record<string, string>;
  splitMode: ExpenseSplitMode;
  onParticipantIdsChange: (participantIds: string[]) => void;
  onParticipantValuesChange: (
    participantValues: Record<string, string>,
  ) => void;
  onSplitModeChange: (splitMode: ExpenseSplitMode) => void;
};

export function getSuggestedParticipantValues(
  mode: ExpenseSplitMode,
  amount: string,
  participantIds: string[],
) {
  if (mode === "equal" || participantIds.length === 0) {
    return {};
  }

  if (mode === "percentage") {
    return Object.fromEntries(
      calculateEqualShares(10_000, participantIds).map((share) => [
        share.memberId,
        (share.shareCents / 100).toFixed(2),
      ]),
    );
  }

  const amountCents = parseCurrencyToCents(amount);

  if (amountCents === null || amountCents <= 0) {
    return Object.fromEntries(
      participantIds.map((memberId) => [memberId, "0.00"]),
    );
  }

  return Object.fromEntries(
    calculateEqualShares(amountCents, participantIds).map((share) => [
      share.memberId,
      (share.shareCents / 100).toFixed(2),
    ]),
  );
}

function getAssignmentDescription(
  splitMode: ExpenseSplitMode,
  participantIds: string[],
  participantValues: Record<string, string>,
) {
  if (splitMode === "equal") {
    return "The amount will be split equally between selected members.";
  }

  if (splitMode === "exact") {
    const values = participantIds.map((memberId) =>
      parseCurrencyToCents(participantValues[memberId] ?? ""),
    );

    if (values.some((value) => value === null)) {
      return "Exact amounts must add up to the expense total.";
    }

    const totalCents = values.reduce<number>(
      (total, value) => total + (value ?? 0),
      0,
    );
    return `${formatCurrencyFromCents(totalCents)} assigned in total.`;
  }

  const values = participantIds.map((memberId) =>
    parsePercentageToBasisPoints(participantValues[memberId] ?? ""),
  );

  if (values.some((value) => value === null)) {
    return "Percentages must add up to 100%.";
  }

  const totalBasisPoints = values.reduce<number>(
    (total, value) => total + (value ?? 0),
    0,
  );
  return `${(totalBasisPoints / 100).toFixed(2)}% assigned in total.`;
}

export function ExpenseSplitFields({
  amount,
  error,
  idPrefix,
  members,
  participantIds,
  participantValues,
  splitMode,
  onParticipantIdsChange,
  onParticipantValuesChange,
  onSplitModeChange,
}: ExpenseSplitFieldsProps) {
  function changeSplitMode(nextMode: ExpenseSplitMode) {
    onSplitModeChange(nextMode);
    onParticipantValuesChange(
      getSuggestedParticipantValues(nextMode, amount, participantIds),
    );
  }

  function toggleParticipant(memberId: string, checked: boolean) {
    const selectedIds = new Set(participantIds);

    if (checked) {
      selectedIds.add(memberId);
    } else {
      selectedIds.delete(memberId);
    }

    const nextParticipantIds = members
      .filter((member) => selectedIds.has(member.id))
      .map((member) => member.id);
    onParticipantIdsChange(nextParticipantIds);

    if (splitMode !== "equal" && checked) {
      onParticipantValuesChange({
        ...participantValues,
        [memberId]:
          splitMode === "percentage" && participantIds.length === 0
            ? "100.00"
            : "0.00",
      });
    }
  }

  return (
    <FieldSet data-invalid={Boolean(error)}>
      <FieldLegend>Split between</FieldLegend>
      <input type="hidden" name="splitMode" value={splitMode} />
      <ToggleGroup
        value={[splitMode]}
        onValueChange={(modes) => {
          const nextMode = modes[0] as ExpenseSplitMode | undefined;
          if (nextMode) {
            changeSplitMode(nextMode);
          }
        }}
        variant="outline"
        className="w-full"
        aria-label="Split mode"
      >
        <ToggleGroupItem type="button" value="equal" className="flex-1">
          Equal
        </ToggleGroupItem>
        <ToggleGroupItem type="button" value="exact" className="flex-1">
          Exact amounts
        </ToggleGroupItem>
        <ToggleGroupItem type="button" value="percentage" className="flex-1">
          Percentage
        </ToggleGroupItem>
      </ToggleGroup>
      <FieldDescription>
        {getAssignmentDescription(
          splitMode,
          participantIds,
          participantValues,
        )}
      </FieldDescription>
      <FieldGroup data-slot="checkbox-group" className="gap-3">
        {members.map((member) => {
          const checked = participantIds.includes(member.id);
          const inputId = `${idPrefix}-share-${member.id}`;

          return (
            <Field
              key={member.id}
              orientation="horizontal"
              data-invalid={Boolean(error)}
            >
              <Checkbox
                id={`${idPrefix}-participant-${member.id}`}
                name="participantIds"
                value={member.id}
                checked={checked}
                onCheckedChange={(nextChecked) =>
                  toggleParticipant(member.id, nextChecked)
                }
                aria-invalid={Boolean(error)}
              />
              <FieldLabel htmlFor={`${idPrefix}-participant-${member.id}`}>
                {member.name}
              </FieldLabel>
              {checked && splitMode !== "equal" ? (
                <>
                  <FieldLabel htmlFor={inputId} className="sr-only">
                    {splitMode === "exact"
                      ? `${member.name} amount`
                      : `${member.name} percentage`}
                  </FieldLabel>
                  <Input
                    id={inputId}
                    name={`participantShare-${member.id}`}
                    value={participantValues[member.id] ?? ""}
                    onChange={(event) =>
                      onParticipantValuesChange({
                        ...participantValues,
                        [member.id]: event.target.value,
                      })
                    }
                    inputMode="decimal"
                    placeholder={
                      splitMode === "exact" ? "0.00" : "0.00%"
                    }
                    min="0"
                    step="0.01"
                    required
                    autoComplete="off"
                    aria-invalid={Boolean(error)}
                    className="max-w-36"
                  />
                </>
              ) : null}
            </Field>
          );
        })}
      </FieldGroup>
      <FieldError>{error}</FieldError>
    </FieldSet>
  );
}
