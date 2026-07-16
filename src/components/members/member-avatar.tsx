import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getMemberInitials } from "@/lib/utils/member";

type MemberAvatarProps = {
  name: string;
};

export function MemberAvatar({ name }: MemberAvatarProps) {
  return (
    <Avatar size="lg">
      <AvatarFallback className="bg-primary-soft font-semibold text-primary">
        {getMemberInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
