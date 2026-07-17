"use client";

import Link from "next/link";
import { LayoutDashboard, LogOut, Settings } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/actions/auth";
import { getAccountInitials } from "@/lib/dashboard/account";
import { cn } from "@/lib/utils";

type AccountMenuProps = {
  displayName: string;
  email: string;
};

export function AccountMenu({ displayName, email }: AccountMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open account menu"
        render={
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "min-h-11 gap-2 px-2 sm:min-h-9",
            )}
          />
        }
      >
        <Avatar size="sm">
          <AvatarFallback>{getAccountInitials(displayName)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate sm:inline">{displayName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-2">
            <span className="truncate text-sm font-medium text-foreground">
              {displayName}
            </span>
            <span className="truncate font-normal" title={email}>
              {email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="min-h-10 gap-2"
            render={<Link href="/dashboard" />}
          >
            <LayoutDashboard aria-hidden="true" />
            Dashboard
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-10 gap-2"
            render={<Link href="/account" />}
          >
            <Settings aria-hidden="true" />
            Account
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <form action={logout}>
          <DropdownMenuItem
            className="min-h-10 w-full gap-2"
            render={<button type="submit" />}
          >
            <LogOut aria-hidden="true" />
            Log out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
