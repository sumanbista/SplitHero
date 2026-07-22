import {
  HandCoins,
  History,
  Mail,
  ReceiptText,
  Settings2,
  UserPlus,
} from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import type {
  GroupActivityEventType,
  GroupActivityItem,
} from "@/lib/group-activity";

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function ActivityIcon({ eventType }: { eventType: GroupActivityEventType }) {
  if (eventType.startsWith("expense.")) return <ReceiptText />;
  if (eventType.startsWith("settlement.")) return <HandCoins />;
  if (eventType.startsWith("member.")) return <UserPlus />;
  if (eventType.startsWith("invitation.")) return <Mail />;
  return <Settings2 />;
}

export function GroupActivityList({
  activities,
}: {
  activities: GroupActivityItem[];
}) {
  if (activities.length === 0) {
    return (
      <Empty className="border bg-primary-soft/40 py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History />
          </EmptyMedia>
          <EmptyTitle>No activity yet</EmptyTitle>
          <EmptyDescription>
            Important group changes will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul aria-label="Recent group activity" className="flex flex-col">
      {activities.map((activity, index) => (
        <li key={activity.id}>
          {index > 0 ? <Separator /> : null}
          <article className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:size-4">
              <ActivityIcon eventType={activity.eventType} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{activity.summary}</p>
              {activity.details ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {activity.details}
                </p>
              ) : null}
              <time
                dateTime={activity.createdAt}
                className="mt-1 block text-xs text-muted-foreground"
              >
                {timestampFormatter.format(new Date(activity.createdAt))} UTC
              </time>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
