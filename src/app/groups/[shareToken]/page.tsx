import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  HandCoins,
  History,
  Link2,
  LockKeyhole,
  ReceiptText,
  Scale,
  Users,
} from "lucide-react";
import { notFound } from "next/navigation";

import { AppLogo } from "@/components/layout/app-logo";
import { SessionNavigation } from "@/components/auth/session-navigation";
import { InvitationManager } from "@/components/invitations/invitation-manager";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import {
  ExpenseList,
  type ExpenseListItem,
} from "@/components/expenses/expense-list";
import {
  BalanceList,
  type BalanceListItem,
} from "@/components/groups/balance-list";
import { GroupSummary } from "@/components/groups/group-summary";
import { GroupAccessDenied } from "@/components/groups/group-access-denied";
import { GroupAccessSettings } from "@/components/groups/group-access-settings";
import { ShareGroupButton } from "@/components/groups/share-group-button";
import { AddMemberDialog } from "@/components/members/add-member-dialog";
import { MemberList } from "@/components/members/member-list";
import {
  SettlementHistory,
  type SettlementHistoryItem,
} from "@/components/settlements/settlement-history";
import {
  SettlementList,
  type SettlementListItem,
} from "@/components/settlements/settlement-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { calculateMemberBalances } from "@/lib/calculations/balances";
import { simplifySettlements } from "@/lib/calculations/settlements";
import { getGroupAccess } from "@/lib/groups/access";
import { createAdminClient } from "@/lib/supabase/admin";

type GroupPageProps = {
  params: Promise<{ shareToken: string }>;
  searchParams: Promise<{ invitation?: string }>;
};

type DashboardSectionProps = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
};

function DashboardSection({
  id,
  title,
  description,
  icon,
  children,
}: DashboardSectionProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary [&_svg]:size-5">
          {icon}
        </span>
        <div>
          <h2 id={id} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function getRelatedRecord<T>(relation: T | T[] | null) {
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

export const metadata: Metadata = {
  title: "Your group",
  description: "A shared SplitHero group.",
};

export default async function GroupPage({ params, searchParams }: GroupPageProps) {
  const { shareToken } = await params;
  const pageState = await searchParams;
  const access = await getGroupAccess(shareToken);

  if (!access) {
    notFound();
  }

  if (!access.permissions.canView) {
    return (
      <GroupAccessDenied
        shareToken={shareToken}
        email={access.user?.email}
      />
    );
  }

  const { group, user, role, permissions } = access;
  const supabase = createAdminClient();
  const invitationsPromise = permissions.canInvite
    ? supabase
        .from("group_invitations")
        .select("id, email, role, expires_at, invited_member:members(name)")
        .eq("group_id", group.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });

  const [membersResult, expensesResult, settlementPaymentsResult, invitationsResult] =
    await Promise.all([
    supabase
      .from("members")
      .select("id, name, user_id")
      .eq("group_id", group.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("expenses")
      .select(
        "id, title, amount_cents, paid_by_member_id, expense_date, paid_by:members!expenses_paid_by_member_id_fkey(id, name), participants:expense_participants(member_id, share_cents, member:members(id, name))",
      )
      .eq("group_id", group.id)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("settlement_payments")
      .select(
        "id, from_member_id, to_member_id, amount_cents, payment_date",
      )
      .eq("group_id", group.id)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false }),
    invitationsPromise,
  ]);

  const { data: members, error: membersError } = membersResult;
  const { data: expenseRows, error: expensesError } = expensesResult;
  const { data: settlementPaymentRows, error: settlementPaymentsError } =
    settlementPaymentsResult;
  const { data: invitationRows, error: invitationsError } = invitationsResult;

  if (membersError || expensesError || settlementPaymentsError || invitationsError) {
    throw new Error("Unable to load group details.");
  }

  const pendingInvitations = invitationRows.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expires_at,
    memberName: getRelatedRecord(invitation.invited_member)?.name ?? null,
  }));
  const availableMembers = members
    .filter((member) => !member.user_id)
    .map((member) => ({ id: member.id, name: member.name }));

  const memberOrder = new Map(
    members.map((member, index) => [member.id, index]),
  );
  const expenses: ExpenseListItem[] = expenseRows.map((expense) => {
    const paidBy = getRelatedRecord(expense.paid_by);

    return {
      id: expense.id,
      title: expense.title,
      amountCents: Number(expense.amount_cents),
      expenseDate: expense.expense_date,
      paidByName: paidBy?.name ?? "Unknown member",
      participants: expense.participants
        .flatMap((participant) => {
          const member = getRelatedRecord(participant.member);

          return member
            ? [
                {
                  memberId: member.id,
                  memberName: member.name,
                  shareCents: Number(participant.share_cents),
                },
              ]
            : [];
        })
        .toSorted(
          (left, right) =>
            (memberOrder.get(left.memberId) ?? Number.MAX_SAFE_INTEGER) -
            (memberOrder.get(right.memberId) ?? Number.MAX_SAFE_INTEGER),
        ),
    };
  });
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const calculatedBalances = calculateMemberBalances(
    members,
    expenseRows.map((expense) => ({
      amountCents: Number(expense.amount_cents),
      paidByMemberId: expense.paid_by_member_id,
      participantShares: expense.participants.map((participant) => ({
        memberId: participant.member_id,
        shareCents: Number(participant.share_cents),
      })),
    })),
    settlementPaymentRows.map((payment) => ({
      fromMemberId: payment.from_member_id,
      toMemberId: payment.to_member_id,
      amountCents: Number(payment.amount_cents),
    })),
  );
  const balances: BalanceListItem[] = calculatedBalances.map((balance) => ({
    ...balance,
    memberName: memberNames.get(balance.memberId) ?? "Unknown member",
  }));
  const settlements: SettlementListItem[] = simplifySettlements(
    calculatedBalances,
  ).map((settlement) => ({
    ...settlement,
    fromMemberName:
      memberNames.get(settlement.fromMemberId) ?? "Unknown member",
    toMemberName:
      memberNames.get(settlement.toMemberId) ?? "Unknown member",
  }));
  const settlementHistory: SettlementHistoryItem[] =
    settlementPaymentRows.map((payment) => ({
      id: payment.id,
      fromMemberName:
        memberNames.get(payment.from_member_id) ?? "Unknown member",
      toMemberName:
        memberNames.get(payment.to_member_id) ?? "Unknown member",
      amountCents: Number(payment.amount_cents),
      paymentDate: payment.payment_date,
    }));
  const totalSpentCents = expenses.reduce(
    (total, expense) => total + expense.amountCents,
    0,
  );

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-6 sm:px-8">
        <AppLogo showMark />
        <nav aria-label="Account navigation" className="flex items-center gap-1 sm:gap-3">
          <SessionNavigation email={user?.email} />
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pt-8 pb-20 sm:px-8 sm:pt-12">
        {pageState.invitation === "accepted" ? (
          <Alert className="border-primary/25 bg-primary-soft/40">
            <AlertDescription className="text-foreground">
              Invitation accepted. This group is now connected to your dashboard.
            </AlertDescription>
          </Alert>
        ) : null}
        <section className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-primary">
              {group.accessMode === "private" ? (
                <LockKeyhole className="size-4" aria-hidden="true" />
              ) : (
                <Link2 className="size-4" aria-hidden="true" />
              )}
              {group.accessMode === "private" ? "Private group" : "Public share-link group"}
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              {group.name}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {members.length === 0
                ? "Start by adding everyone in the group."
                : `${members.length} ${members.length === 1 ? "member" : "members"}`}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {permissions.canContribute ? (
              <AddExpenseDialog shareToken={shareToken} members={members} />
            ) : null}
            {permissions.canManageMembers ? (
              <AddMemberDialog shareToken={shareToken} />
            ) : null}
          </div>
        </section>

        {!permissions.canContribute ? (
          <Alert className="border-primary/25 bg-primary-soft/40">
            <AlertDescription className="text-foreground">
              You have viewer access. You can review members, expenses, balances,
              and payment history, but you can’t change this group.
            </AlertDescription>
          </Alert>
        ) : role === "member" && group.accessMode === "private" ? (
          <Alert className="border-primary/25 bg-primary-soft/40">
            <AlertDescription className="text-foreground">
              You’re a group member. You can add expenses and record payments;
              the owner manages people and access settings.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-10">
            <GroupSummary
              totalSpentCents={totalSpentCents}
              memberCount={members.length}
              expenseCount={expenses.length}
              settlementCount={settlements.length}
            />

            <DashboardSection
              id="settlements-title"
              title="Settle up"
              description="Recommended payments to settle the group."
              icon={<HandCoins aria-hidden="true" />}
            >
              <SettlementList
                shareToken={shareToken}
                settlements={settlements}
                hasExpenses={expenses.length > 0}
                canRecord={permissions.canContribute}
              />
            </DashboardSection>

            <DashboardSection
              id="balances-title"
              title="Balances"
              description="What each person owes or gets back."
              icon={<Scale aria-hidden="true" />}
            >
              <BalanceList
                balances={balances}
                hasExpenses={expenses.length > 0}
              />
            </DashboardSection>

            <DashboardSection
              id="expenses-title"
              title="Expenses"
              description="Shared costs recorded by this group."
              icon={<ReceiptText aria-hidden="true" />}
            >
              <ExpenseList
                expenses={expenses}
                hasMembers={members.length > 0}
              />
            </DashboardSection>

            <DashboardSection
              id="payment-history-title"
              title="Payment history"
              description="Settlement payments recorded by this group."
              icon={<History aria-hidden="true" />}
            >
              <Card>
                <CardContent>
                  <SettlementHistory payments={settlementHistory} />
                </CardContent>
              </Card>
            </DashboardSection>
          </div>

          <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Users className="size-5" />
                  </span>
                  <div>
                    <CardTitle>Members</CardTitle>
                    <CardDescription>Everyone in this group.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <MemberList members={members} />
              </CardContent>
            </Card>

            {permissions.canInvite ? (
              <Card>
                <CardHeader>
                  <CardTitle>Invitations</CardTitle>
                  <CardDescription>Connect people to this group.</CardDescription>
                </CardHeader>
                <CardContent>
                  <InvitationManager
                    shareToken={shareToken}
                    members={availableMembers}
                    pendingInvitations={pendingInvitations}
                  />
                </CardContent>
              </Card>
            ) : null}

            {permissions.canChangeAccess ? (
              <Card>
                <CardHeader>
                  <CardTitle>Group access</CardTitle>
                  <CardDescription>
                    Choose between guest-friendly sharing and invited access.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GroupAccessSettings
                    shareToken={shareToken}
                    accessMode={group.accessMode}
                  />
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>
                  {group.accessMode === "private" ? "Group link" : "Share group"}
                </CardTitle>
                <CardDescription>
                  {group.accessMode === "private"
                    ? "Only invited members can open this link."
                    : "Anyone with this link can view and contribute."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ShareGroupButton />
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
