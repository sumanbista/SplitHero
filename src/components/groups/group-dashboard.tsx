"use client";

import { useState, type ReactNode } from "react";

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const dashboardViews = ["overview", "expenses", "activity", "payments"] as const;

type DashboardView = (typeof dashboardViews)[number];

const dashboardViewLabels: Record<DashboardView, string> = {
  overview: "Overview",
  expenses: "Expenses",
  activity: "Activity",
  payments: "Payments",
};

type GroupDashboardProps = {
  hasActions?: boolean;
  overview: ReactNode;
  expenses: ReactNode;
  activity: ReactNode;
  payments: ReactNode;
};

export function GroupDashboard({
  hasActions = false,
  overview,
  expenses,
  activity,
  payments,
}: GroupDashboardProps) {
  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const panels: Record<DashboardView, ReactNode> = {
    overview,
    expenses,
    activity,
    payments,
  };

  return (
    <>
      <nav
        aria-label="Group dashboard views"
        className="sticky top-0 z-20 -mx-6 border-y bg-background/95 px-6 backdrop-blur-sm sm:-mx-8 sm:px-8"
      >
        <ToggleGroup
          value={[activeView]}
          onValueChange={(views) => {
            const nextView = views[0] as DashboardView | undefined;
            if (nextView) setActiveView(nextView);
          }}
          aria-label="Choose a group dashboard view"
          className="grid h-14 w-full grid-cols-4 gap-0 rounded-none sm:flex sm:w-fit sm:gap-7"
        >
          {dashboardViews.map((view) => (
            <ToggleGroupItem
              key={view}
              value={view}
              type="button"
              aria-controls={`dashboard-panel-${view}`}
              className="relative h-14 min-w-0 rounded-none px-1 text-[0.8rem] text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:bg-transparent aria-pressed:font-semibold aria-pressed:text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform aria-pressed:after:scale-x-100 sm:min-w-24 sm:px-3 sm:text-sm"
            >
              {dashboardViewLabels[view]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </nav>

      <div
        id={`dashboard-panel-${activeView}`}
        aria-label={dashboardViewLabels[activeView]}
        className={cn("pt-5 sm:pt-8", hasActions && "pb-24 sm:pb-0")}
      >
        {panels[activeView]}
      </div>
    </>
  );
}
