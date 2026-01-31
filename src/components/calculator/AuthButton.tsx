import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const AuthButton = () => {
  // Feature temporarily disabled
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 opacity-50 cursor-not-allowed"
          disabled
        >
          <User className="w-4 h-4" />
          <span className="hidden sm:inline">Sign in</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Currently unavailable</p>
      </TooltipContent>
    </Tooltip>
  );
};
