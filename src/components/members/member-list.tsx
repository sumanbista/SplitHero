import { Users } from "lucide-react";

import { MemberAvatar } from "@/components/members/member-avatar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";

type Member = {
  id: string;
  name: string;
};

type MemberListProps = {
  members: Member[];
};

export function MemberList({ members }: MemberListProps) {
  if (members.length === 0) {
    return (
      <Empty className="border bg-primary-soft/40 py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>No members yet</EmptyTitle>
          <EmptyDescription>
            Add the people who will share expenses in this group.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul aria-label="Group members" className="flex flex-col">
      {members.map((member, index) => (
        <li key={member.id}>
          {index > 0 ? <Separator /> : null}
          <div className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
            <MemberAvatar name={member.name} />
            <span className="min-w-0 truncate font-medium">{member.name}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
