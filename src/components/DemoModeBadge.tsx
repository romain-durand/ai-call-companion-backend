import { Badge } from "@/components/ui/badge";

export default function DemoModeBadge() {
  return (
    <Badge
      variant="outline"
      className="text-[10px] h-5 px-2 rounded-full border-primary/30 text-primary bg-primary/5 font-normal"
    >
      Mode démo
    </Badge>
  );
}
