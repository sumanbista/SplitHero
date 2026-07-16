import { History } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { formatCurrencyFromCents } from "@/lib/utils/currency";
import { formatPaymentDate } from "@/lib/utils/date";

export type SettlementHistoryItem = {
  id: string;
  fromMemberName: string;
  toMemberName: string;
  amountCents: number;
  paymentDate: string;
};

export function SettlementHistory({
  payments,
}: {
  payments: SettlementHistoryItem[];
}) {
  if (payments.length === 0) {
    return (
      <Empty className="border bg-primary-soft/40 py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History />
          </EmptyMedia>
          <EmptyTitle>No payments recorded</EmptyTitle>
          <EmptyDescription>
            Completed settlement payments will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul aria-label="Settlement history" className="flex flex-col">
      {payments.map((payment, index) => (
        <li key={payment.id}>
          {index > 0 ? <Separator /> : null}
          <article className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="font-medium">
                {payment.fromMemberName} paid {payment.toMemberName}
              </p>
              <time className="mt-1 block text-sm text-muted-foreground">
                Paid on {formatPaymentDate(payment.paymentDate)}
              </time>
            </div>
            <p className="shrink-0 font-semibold tabular-nums text-success">
              {formatCurrencyFromCents(payment.amountCents)}
            </p>
          </article>
        </li>
      ))}
    </ul>
  );
}
