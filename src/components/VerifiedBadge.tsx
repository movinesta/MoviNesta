import { BadgeCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type VerifiedBadgeType = "identity" | "official" | "trusted_verifier" | "subscription";

export interface VerifiedBadgeProps {
  isVerified?: boolean | null;
  type?: VerifiedBadgeType | null;
  label?: string | null;
  verifiedAt?: string | null; // ISO string
  org?: string | null;
  className?: string;
}

const formatBadgeType = (t?: VerifiedBadgeType | null) => {
  if (!t) return "Verified";
  switch (t) {
    case "identity":
      return "Identity verified";
    case "official":
      return "Official account";
    case "trusted_verifier":
      return "Verified by organization";
    case "subscription":
      return "Subscription badge";
    default:
      return "Verified";
  }
};

const formatDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
};

export function VerifiedBadge({
  isVerified,
  type,
  label,
  verifiedAt,
  org,
  className,
}: VerifiedBadgeProps) {
  if (!isVerified) return null;

  const title = label?.trim() || formatBadgeType(type);
  const date = formatDate(verifiedAt);
  const orgLine = org?.trim() ? org.trim() : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            className ??
            "inline-flex items-center justify-center rounded-full p-1 text-primary/90 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          }
          aria-label={title}
        >
          <BadgeCheck className="h-5 w-5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="text-sm font-semibold">{title}</div>
            {orgLine ? (
              <div className="text-xs text-muted-foreground">{orgLine}</div>
            ) : (
              <div className="text-xs text-muted-foreground">{formatBadgeType(type)}</div>
            )}
            {date ? <div className="text-xs text-muted-foreground">Verified on {date}</div> : null}
          </div>

          <Link
            to="/help/verification"
            className="inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            What does verification mean?
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default VerifiedBadge;
