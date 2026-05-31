import { Star } from "lucide-react";

type Props = {
  isPriority: boolean;
};

export function PriorityBadge({ isPriority }: Props) {
  if (!isPriority) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      <Star className="size-3 fill-current" aria-hidden />
      Prioritária
    </span>
  );
}
