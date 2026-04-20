import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export default function BackToSettingsButton() {
  return (
    <Link
      to="/more"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
    >
      <ChevronLeft className="w-4 h-4" />
      Réglages
    </Link>
  );
}
