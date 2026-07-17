import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HandCoins, History, ReceiptText, Scale, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { AppLogo } from "@/components/layout/app-logo";
import { SessionNavigation } from "@/components/auth/session-navigation";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { calculateMemberBalances } from "@/lib/calculations/balances";
import { simplifySettlements } from "@/lib/calculations/settlements";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type GroupPageProps = {
  params: Promise<{ shareToken: string }>;
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

export default async function GroupPage({ params }: GroupPageProps) {
  const { shareToken } = await params;
  const userPromise = getCurrentUser();
  const supabase = createAdminClient();
  const { data: group, error } = await supabase
    .from("groups")
    .select("id, name")
    .eq("share_token", shareToken)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load the group.");
  }

  if (!group) {
    notFound();
  }

  const [membersResult, expensesResult, settlementPaymentsResult, user] =
    await Promise.all([
    supabase
      .from("members")
      .select("id, name")
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
    userPromise,
  ]);

  const { data: members, error: membersError } = membersResult;
  const { data: expenseRows, error: expensesError } = expensesResult;
  const { data: settlementPaymentRows, error: settlementPaymentsError } =
    settlementPaymentsResult;

  if (membersError || expensesError || settlementPaymentsError) {
    throw new Error("Unable to load group details.");
  }

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
        <section className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Your group</p>
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
            <AddExpenseDialog shareToken={shareToken} members={members} />
            <AddMemberDialog shareToken={shareToken} />
          </div>
        </section>

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

            <Card>
              <CardHeader>
                <CardTitle>Share group</CardTitle>
                <CardDescription>Keep everyone on the same page.</CardDescription>
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
