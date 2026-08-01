import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export type GroupSettingsItem = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  content: ReactNode;
};

export function GroupSettingsPanel({
  items,
}: {
  items: GroupSettingsItem[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Group settings</CardTitle>
        <CardDescription>
          People, access, and sharing controls.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {items.map((item, index) => (
          <div key={item.id}>
            {index > 0 ? <Separator /> : null}
            <details className="group">
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:size-4">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="px-4 pt-1 pb-5 sm:px-5">{item.content}</div>
            </details>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
