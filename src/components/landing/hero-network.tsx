import { Check, UserRound } from "lucide-react";

export function HeroNetwork() {
  return (
    <div
      aria-hidden="true"
      className="relative hidden h-44 w-80 sm:block"
    >
      <svg
        className="absolute inset-0 size-full text-primary/35"
        viewBox="0 0 320 176"
        fill="none"
      >
        <path
          d="M64 136C111 128 108 62 160 48M160 48C201 61 207 124 256 136M64 136C122 151 199 151 256 136M160 48V136"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="7 8"
        />
      </svg>
      <span className="absolute top-2 left-1/2 flex size-16 -translate-x-1/2 items-center justify-center rounded-full bg-primary-soft text-primary ring-1 ring-primary/10">
        <UserRound className="size-7" strokeWidth={1.75} />
      </span>
      <span className="absolute bottom-0 left-5 flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary ring-1 ring-primary/10">
        <UserRound className="size-7" strokeWidth={1.75} />
      </span>
      <span className="absolute bottom-0 left-1/2 flex size-16 -translate-x-1/2 items-center justify-center rounded-full bg-primary-soft text-primary ring-1 ring-primary/10">
        <Check className="size-7" strokeWidth={2} />
      </span>
      <span className="absolute right-5 bottom-0 flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary ring-1 ring-primary/10">
        <UserRound className="size-7" strokeWidth={1.75} />
      </span>
    </div>
  );
}
