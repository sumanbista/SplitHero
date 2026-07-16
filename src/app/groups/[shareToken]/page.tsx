import type { Metadata } from "next";
import { Link2, ReceiptText, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { AppLogo } from "@/components/layout/app-logo";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import {
  ExpenseList,
  type ExpenseListItem,
} from "@/components/expenses/expense-list";
import { AddMemberDialog } from "@/components/members/add-member-dialog";
import { MemberList } from "@/components/members/member-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";

type GroupPageProps = {
  params: Promise<{ shareToken: string }>;
};

function getRelatedRecord<T>(relation: T | T[] | null) {
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

export const metadata: Metadata = {
  title: "Your group",
  description: "A shared SplitHero group.",
};

export default async function GroupPage({ params }: GroupPageProps) {
  const { shareToken } = await params;
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

  const [membersResult, expensesResult] = await Promise.all([
    supabase
      .from("members")
      .select("id, name")
      .eq("group_id", group.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("expenses")
      .select(
        "id, title, amount_cents, expense_date, paid_by:members!expenses_paid_by_member_id_fkey(id, name), participants:expense_participants(share_cents, member:members(id, name))",
      )
      .eq("group_id", group.id)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const { data: members, error: membersError } = membersResult;
  const { data: expenseRows, error: expensesError } = expensesResult;

  if (membersError || expensesError) {
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

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-6 sm:px-8">
        <AppLogo showMark />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pt-10 pb-20 sm:px-8 sm:pt-16">
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
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <ReceiptText className="size-5" />
                </span>
                <div>
                  <CardTitle>Expenses</CardTitle>
                  <CardDescription>
                    Shared costs recorded by this group.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ExpenseList
                expenses={expenses}
                hasMembers={members.length > 0}
              />
            </CardContent>
          </Card>

          <aside className="flex flex-col gap-6">
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
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="size-4 text-primary" />
                  Keep this link handy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-6 text-muted-foreground">
                  Share this page’s private link with everyone who belongs in
                  the group.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
