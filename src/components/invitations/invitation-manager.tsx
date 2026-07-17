"use client";

import { Check, Copy, MailPlus } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createInvitation,
  type CreateInvitationState,
} from "@/lib/actions/invitations";

type AvailableMember = { id: string; name: string };
type PendingInvitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  memberName: string | null;
};

type InvitationManagerProps = {
  shareToken: string;
  members: AvailableMember[];
  pendingInvitations: PendingInvitation[];
};

const initialState: CreateInvitationState = {};

export function InvitationManager({
  shareToken,
  members,
  pendingInvitations,
}: InvitationManagerProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const action = createInvitation.bind(null, shareToken);
  const [state, formAction, pending] = useActionState(action, initialState);
  const inviteUrl = state.invitationUrl ?? null;

  async function copyInvitation() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(new URL(inviteUrl, window.location.origin).toString());
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button className="w-full" variant="outline" />}>
          <MailPlus data-icon="inline-start" />
          Invite by email
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite someone</DialogTitle>
            <DialogDescription>
              Create a secure, seven-day invitation for their email address.
            </DialogDescription>
          </DialogHeader>
          {inviteUrl ? (
            <div className="flex flex-col gap-4">
              <Alert className="border-primary/25 bg-primary-soft/40">
                <AlertDescription className="text-foreground">
                  Invitation ready for {state.invitedEmail}. Send them this private link.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly aria-label="Invitation link" />
                <Button type="button" variant="outline" size="icon" onClick={copyInvitation}>
                  {copied ? <Check /> : <Copy />}
                  <span className="sr-only">Copy invitation link</span>
                </Button>
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form action={formAction}>
              <FieldGroup>
                <Field data-invalid={Boolean(state.fieldErrors?.email?.length)}>
                  <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                  <Input
                    id="invite-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="alex@example.com"
                    required
                    aria-invalid={Boolean(state.fieldErrors?.email?.length)}
                  />
                  <FieldError errors={state.fieldErrors?.email?.map((message) => ({ message }))} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="invite-role">Role</FieldLabel>
                  <Select name="role" defaultValue="member">
                    <SelectTrigger id="invite-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field data-invalid={Boolean(state.fieldErrors?.memberId?.length)}>
                  <FieldLabel htmlFor="invite-member">Connect expense history</FieldLabel>
                  <Select name="memberId" defaultValue="none">
                    <SelectTrigger id="invite-member" className="w-full">
                      <SelectValue placeholder="No existing member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No existing member</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={state.fieldErrors?.memberId?.map((message) => ({ message }))} />
                </Field>
                {state.formError ? (
                  <Alert variant="destructive"><AlertDescription>{state.formError}</AlertDescription></Alert>
                ) : null}
                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Creating invitation…" : "Create invitation"}
                  </Button>
                </DialogFooter>
              </FieldGroup>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {pendingInvitations.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending</p>
          <ul className="mt-2 flex flex-col gap-3">
            {pendingInvitations.map((invitation) => (
              <li key={invitation.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="truncate font-medium" title={invitation.email}>{invitation.email}</p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">
                  {invitation.role}{invitation.memberName ? ` · linked to ${invitation.memberName}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
