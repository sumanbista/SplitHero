import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Archive,
  ArrowLeft,
  HandCoins,
  History,
  Link2,
  LockKeyhole,
  Mail,
  ReceiptText,
  Scale,
  Settings2,
  Users,
  Activity as ActivityIcon,
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
import { GroupDashboard } from "@/components/groups/group-dashboard";
import {
  GroupSettingsPanel,
  type GroupSettingsItem,
} from "@/components/groups/group-settings-panel";
import { GroupActivityList } from "@/components/groups/group-activity-list";
import { GroupAccessDenied } from "@/components/groups/group-access-denied";
import { GroupAccessSettings } from "@/components/groups/group-access-settings";
import { GroupDetailsSettings } from "@/components/groups/group-details-settings";
import { GroupLifecycleSettings } from "@/components/groups/group-lifecycle-settings";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { explainMemberBalance } from "@/lib/calculations/balance-explanation";
import { calculateMemberBalances } from "@/lib/calculations/balances";
import { simplifySettlements } from "@/lib/calculations/settlements";
import { getGroupAccess } from "@/lib/groups/access";
import {
  formatGroupActivityEvent,
  type GroupActivityEventType,
} from "@/lib/group-activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { getMemberDisplayName } from "@/lib/utils/member";

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
        user={access.user}
      />
    );
  }

  const { group, user, role, permissions } = access;
  const isArchived = group.archivedAt !== null;
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

  const [membersResult, expensesResult, settlementPaymentsResult, invitationsResult, activityResult] =
    await Promise.all([
    supabase
      .from("members")
      .select("id, name, user_id, is_active, archived_at")
      .eq("group_id", group.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("expenses")
      .select(
        "id, title, amount_cents, paid_by_member_id, split_mode, expense_date, notes, updated_at, paid_by:members!expenses_paid_by_member_id_fkey(id, name), participants:expense_participants(member_id, share_cents, percentage_basis_points, member:members(id, name))",
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
    supabase
      .from("group_activity_events")
      .select("id, actor_name_snapshot, event_type, metadata, created_at")
      .eq("group_id", group.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50),
  ]);

  const { data: members, error: membersError } = membersResult;
  const { data: expenseRows, error: expensesError } = expensesResult;
  const { data: settlementPaymentRows, error: settlementPaymentsError } =
    settlementPaymentsResult;
  const { data: invitationRows, error: invitationsError } = invitationsResult;
  const { data: activityRows, error: activityError } = activityResult;

  if (
    membersError ||
    expensesError ||
    settlementPaymentsError ||
    invitationsError ||
    activityError
  ) {
    throw new Error("Unable to load group details.");
  }

  const linkedUserIds = [
    ...new Set(
      members.flatMap((member) => member.user_id ? [member.user_id] : []),
    ),
  ];
  const profilesResult = linkedUserIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", linkedUserIds)
    : { data: [], error: null };

  if (profilesResult.error) {
    throw new Error("Unable to load group member profiles.");
  }

  const profileDisplayNames = new Map(
    profilesResult.data.map((profile) => [profile.id, profile.display_name]),
  );
  const displayedMembers = members.map((member) => ({
    ...member,
    name: member.user_id
      ? getMemberDisplayName(
          member.name,
          profileDisplayNames.get(member.user_id),
        )
      : member.name,
  }));
  const activeMembers = displayedMembers.filter((member) => member.is_active);
  const memberNames = new Map(
    displayedMembers.map((member) => [member.id, member.name]),
  );

  const pendingInvitations = invitationRows.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expires_at,
    memberName: getRelatedRecord(invitation.invited_member)?.name ?? null,
  }));
  const availableMembers = displayedMembers
    .filter((member) => member.is_active && !member.user_id)
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
      notes: expense.notes ?? "",
      paidByMemberId: expense.paid_by_member_id,
      splitMode: expense.split_mode,
      paidByName: paidBy
        ? memberNames.get(paidBy.id) ?? paidBy.name
        : "Unknown member",
      updatedAt: expense.updated_at,
      participants: expense.participants
        .flatMap((participant) => {
          const member = getRelatedRecord(participant.member);

          return member
            ? [
                {
                  memberId: member.id,
                  memberName: memberNames.get(member.id) ?? member.name,
                  shareCents: Number(participant.share_cents),
                  percentageBasisPoints:
                    participant.percentage_basis_points === null
                      ? null
                      : Number(participant.percentage_basis_points),
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
  const explainableExpenses = expenses.map((expense) => ({
    id: expense.id,
    title: expense.title,
    date: expense.expenseDate,
    amountCents: expense.amountCents,
    paidByMemberId: expense.paidByMemberId,
    paidByName: expense.paidByName,
    participantShares: expense.participants.map((participant) => ({
      memberId: participant.memberId,
      shareCents: participant.shareCents,
    })),
  }));
  const explainablePayments = settlementPaymentRows.map((payment) => ({
    id: payment.id,
    date: payment.payment_date,
    fromMemberId: payment.from_member_id,
    fromMemberName:
      memberNames.get(payment.from_member_id) ?? "Unknown member",
    toMemberId: payment.to_member_id,
    toMemberName: memberNames.get(payment.to_member_id) ?? "Unknown member",
    amountCents: Number(payment.amount_cents),
  }));
  const balanceExplanations = Object.fromEntries(
    members.map((member) => [
      member.id,
      explainMemberBalance(member.id, explainableExpenses, explainablePayments),
    ]),
  );
  const balanceByMemberId = new Map(
    calculatedBalances.map((balance) => [balance.memberId, balance.balanceCents]),
  );
  const memberSummaries = displayedMembers.map((member) => {
    let totalPaidCents = 0;
    let totalShareCents = 0;
    let paidExpenseCount = 0;
    let participatedExpenseCount = 0;
    let sentPaymentCents = 0;
    let receivedPaymentCents = 0;

    for (const expense of expenseRows) {
      if (expense.paid_by_member_id === member.id) {
        totalPaidCents += Number(expense.amount_cents);
        paidExpenseCount += 1;
      }
      const participant = expense.participants.find(
        (share) => share.member_id === member.id,
      );
      if (participant) {
        totalShareCents += Number(participant.share_cents);
        participatedExpenseCount += 1;
      }
    }

    for (const payment of settlementPaymentRows) {
      if (payment.from_member_id === member.id) {
        sentPaymentCents += Number(payment.amount_cents);
      }
      if (payment.to_member_id === member.id) {
        receivedPaymentCents += Number(payment.amount_cents);
      }
    }

    return {
      id: member.id,
      name: member.name,
      isActive: member.is_active,
      isAccountLinked:
        permissions.canManageMembers && Boolean(member.user_id),
      balanceCents: balanceByMemberId.get(member.id) ?? 0,
      totalPaidCents,
      totalShareCents,
      paidExpenseCount,
      participatedExpenseCount,
      sentPaymentCents,
      receivedPaymentCents,
    };
  });
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
  const activities = activityRows.map((activity) =>
    formatGroupActivityEvent({
      id: String(activity.id),
      actorName: activity.actor_name_snapshot,
      eventType: activity.event_type as GroupActivityEventType,
      metadata: activity.metadata,
      createdAt: activity.created_at,
    }),
  );
  const groupSettingsItems: GroupSettingsItem[] = [];

  if (permissions.canInvite) {
    groupSettingsItems.push({
      id: "invitations",
      title: "Invitations",
      description: "Connect people to this group.",
      icon: <Mail aria-hidden="true" />,
      content: (
        <InvitationManager
          shareToken={shareToken}
          members={availableMembers}
          pendingInvitations={pendingInvitations}
        />
      ),
    });
  }

  if (permissions.canChangeAccess) {
    groupSettingsItems.push({
      id: "group-access",
      title: "Group access",
      description: "Choose who can open this group.",
      icon: <LockKeyhole aria-hidden="true" />,
      content: (
        <GroupAccessSettings
          shareToken={shareToken}
          accessMode={group.accessMode}
        />
      ),
    });
  }

  if (permissions.canEditGroup) {
    groupSettingsItems.push({
      id: "group-details",
      title: "Group details",
      description: "Update the name and description.",
      icon: <Settings2 aria-hidden="true" />,
      content: (
        <GroupDetailsSettings
          shareToken={shareToken}
          name={group.name}
          description={group.description}
        />
      ),
    });
  }

  if (
    permissions.canArchiveGroup ||
    permissions.canRestoreGroup ||
    permissions.canDeleteGroup
  ) {
    groupSettingsItems.push({
      id: "group-lifecycle",
      title: "Group lifecycle",
      description: isArchived
        ? "Restore or permanently erase this group."
        : "Archive this group as read-only.",
      icon: <Archive aria-hidden="true" />,
      content: (
        <GroupLifecycleSettings
          shareToken={shareToken}
          groupName={group.name}
          isArchived={isArchived}
        />
      ),
    });
  }

  groupSettingsItems.push({
    id: "group-link",
    title: group.accessMode === "private" ? "Group link" : "Share group",
    description:
      group.accessMode === "private"
        ? "Only invited members can open this link."
        : "Anyone with this link can view and contribute.",
    icon: <Link2 aria-hidden="true" />,
    content: <ShareGroupButton />,
  });

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-6 sm:px-8">
        <AppLogo href={user ? "/dashboard" : "/"} showMark />
        <nav aria-label="Account navigation" className="flex items-center gap-1 sm:gap-3">
          <SessionNavigation user={user} />
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pt-4 pb-20 sm:gap-8 sm:px-8 sm:pt-12">
        {user ? (
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "-ml-2 w-fit",
            )}
          >
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Back to groups
          </Link>
        ) : null}
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
              {isArchived ? (
                <>
                  <Archive className="size-4" aria-hidden="true" />
                  Archived ·
                </>
              ) : null}
              {group.accessMode === "private" ? (
                <LockKeyhole className="size-4" aria-hidden="true" />
              ) : (
                <Link2 className="size-4" aria-hidden="true" />
              )}
              {group.accessMode === "private" ? "Private group" : "Public share-link group"}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">
              {group.name}
            </h1>
            {group.description ? (
              <p className="mt-3 max-w-2xl whitespace-pre-wrap text-base leading-7 text-muted-foreground">
                {group.description}
              </p>
            ) : null}
            <p className="mt-3 text-muted-foreground">
              {activeMembers.length === 0
                ? "Start by adding everyone in the group."
                : `${activeMembers.length} active ${activeMembers.length === 1 ? "member" : "members"}`}
            </p>
          </div>
          {permissions.canContribute || permissions.canManageMembers ? (
            <div
              className={cn(
                "fixed inset-x-0 bottom-0 z-20 grid gap-2 border-t bg-card/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(23,33,29,0.08)] backdrop-blur-sm [&_[data-slot=button]]:h-12 [&_[data-slot=button]]:w-full [&_[data-slot=button]]:text-sm sm:static sm:flex sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none sm:[&_[data-slot=button]]:h-9 sm:[&_[data-slot=button]]:w-auto",
                permissions.canContribute && permissions.canManageMembers
                  ? "grid-cols-2"
                  : "grid-cols-1",
              )}
            >
              {permissions.canContribute ? (
                <AddExpenseDialog
                  shareToken={shareToken}
                  members={activeMembers}
                />
              ) : null}
              {permissions.canManageMembers ? (
                <AddMemberDialog shareToken={shareToken} />
              ) : null}
            </div>
          ) : null}
        </section>

        {isArchived ? (
          <Alert className="border-primary/25 bg-primary-soft/40">
            <Archive aria-hidden="true" />
            <AlertTitle>This group is archived</AlertTitle>
            <AlertDescription className="text-foreground">
              Its members, expenses, balances, settlements, invitations, and
              activity are preserved, but the group is read-only until its
              owner restores it.
            </AlertDescription>
          </Alert>
        ) : !permissions.canContribute ? (
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

        <GroupDashboard
          hasActions={permissions.canContribute || permissions.canManageMembers}
          overview={
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="flex min-w-0 flex-col gap-8">
                <GroupSummary
                  totalSpentCents={totalSpentCents}
                  memberCount={activeMembers.length}
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
                    explanations={balanceExplanations}
                  />
                </DashboardSection>
              </div>

              <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-20 lg:self-start">
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
                    <MemberList
                      members={memberSummaries}
                      shareToken={shareToken}
                      canManage={
                        permissions.canRenameMembers &&
                        permissions.canArchiveMembers &&
                        permissions.canRemoveMembers
                      }
                    />
                  </CardContent>
                </Card>
                <GroupSettingsPanel items={groupSettingsItems} />
              </aside>
            </div>
          }
          expenses={
            <div className="mx-auto max-w-3xl">
              <DashboardSection
                id="expenses-title"
                title="Expenses"
                description="Shared costs recorded by this group."
                icon={<ReceiptText aria-hidden="true" />}
              >
                <ExpenseList
                  expenses={expenses}
                  hasMembers={activeMembers.length > 0}
                  hasSettlementPayments={settlementPaymentRows.length > 0}
                  members={displayedMembers.map((member) => ({
                    id: member.id,
                    name: member.name,
                    isActive: member.is_active,
                  }))}
                  canManageExpenses={
                    permissions.canEditExpenses && permissions.canDeleteExpenses
                  }
                  shareToken={shareToken}
                />
              </DashboardSection>
            </div>
          }
          activity={
            <div className="mx-auto max-w-3xl">
              <DashboardSection
                id="activity-title"
                title="Recent activity"
                description="Important changes made within this group."
                icon={<ActivityIcon aria-hidden="true" />}
              >
                <Card>
                  <CardContent>
                    <GroupActivityList activities={activities} />
                  </CardContent>
                </Card>
              </DashboardSection>
            </div>
          }
          payments={
            <div className="mx-auto max-w-3xl">
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
          }
        />
      </main>
    </div>
  );
}
