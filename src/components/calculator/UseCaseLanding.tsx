import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Compass, 
  ArrowRight,
  Target,
} from "lucide-react";

export type EntryPath = 'strategic' | 'manual' | 'custom';

interface UseCaseLandingProps {
  onSelectPath: (path: EntryPath) => void;
}

export const UseCaseLanding = ({ onSelectPath }: UseCaseLandingProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Choose Discovery Path</h2>
        <p className="text-muted-foreground">
          Select how to identify and quantify value drivers for this prospect
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Strategic Objectives Path - RECOMMENDED */}
        <Card 
          className="p-6 cursor-pointer hover:shadow-lg border-primary border-2 shadow-md transition-all group relative overflow-hidden bg-primary/5"
          onClick={() => onSelectPath('strategic')}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-full" />
          <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground">
            Recommended
          </Badge>
          <div className="relative">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-colors">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Strategic Objectives</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start with prospect priorities and discover relevant use cases
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground mb-4">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-primary" />
                Guided discovery
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-primary" />
                Objective-driven filtering
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-primary" />
                Recommended for new prospects
              </li>
            </ul>
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Explore <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>

        {/* Manual Discovery Path */}
        <Card 
          className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group relative overflow-hidden"
          onClick={() => onSelectPath('manual')}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-secondary/30 to-transparent rounded-bl-full" />
          <div className="relative">
            <div className="w-12 h-12 rounded-lg bg-secondary/20 flex items-center justify-center mb-4 group-hover:bg-secondary/30 transition-colors">
              <Compass className="w-6 h-6 text-secondary-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Challenge Led Discovery</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start with prospect challenges and discover related solutions
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground mb-4">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-secondary-foreground" />
                Challenge-driven approach
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-secondary-foreground" />
                Full flexibility
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-secondary-foreground" />
                Expert mode
              </li>
            </ul>
            <Button variant="ghost" className="w-full group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors">
              Explore <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
