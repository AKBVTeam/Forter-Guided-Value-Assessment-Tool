import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ALL_CHALLENGES, ChallengeDefinition } from "@/lib/calculations";
import { SolutionMapping } from "./SolutionMapping";

interface ChallengeSelectionProps {
  selectedChallenges: { [key: string]: boolean };
  onChallengeChange: (challengeId: string, checked: boolean) => void;
}

// Group challenges by category
const groupByCategory = (challenges: ChallengeDefinition[]) => {
  const grouped: { [category: string]: ChallengeDefinition[] } = {};
  challenges.forEach(c => {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  });
  return grouped;
};

export const ChallengeSelection = ({
  selectedChallenges,
  onChallengeChange,
}: ChallengeSelectionProps) => {
  const groupedChallenges = groupByCategory(ALL_CHALLENGES);
  const categories = Object.keys(groupedChallenges);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Customer Challenge Areas
          <span className="text-sm text-muted-foreground ml-2">(select relevant challenges to drive tailored solution package)</span>
        </h3>
        
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Challenges list - takes 2 columns */}
          <div className="lg:col-span-2 space-y-4">
            {categories.map((category) => {
              const challenges = groupedChallenges[category];
              const hasEnabledChallenges = challenges.some(c => c.enabled);
              
              return (
                <Card key={category} className={`p-4 ${!hasEnabledChallenges ? 'bg-muted/30' : ''}`}>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    {category}
                    {!hasEnabledChallenges && <span className="text-xs text-muted-foreground">(Coming soon)</span>}
                  </h4>
                  <div className="space-y-2">
                    {challenges.map((challenge) => (
                      <div key={challenge.id} className="flex items-start gap-2">
                        <Checkbox
                          id={`challenge-${challenge.id}`}
                          disabled={!challenge.enabled}
                          checked={selectedChallenges[challenge.id] || false}
                          onCheckedChange={(checked) => onChallengeChange(challenge.id, checked as boolean)}
                          className={!challenge.enabled ? 'opacity-50' : ''}
                        />
                        <Label 
                          htmlFor={`challenge-${challenge.id}`}
                          className={`text-sm leading-tight peer-disabled:cursor-not-allowed ${!challenge.enabled ? 'text-muted-foreground opacity-50' : ''}`}
                        >
                          <span className="font-medium mr-1">{challenge.number}.</span>
                          {challenge.name}
                          {!challenge.enabled && <span className="ml-2 text-xs">(WIP)</span>}
                        </Label>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Solution Mapping - takes 1 column on the right */}
          <div className="lg:col-span-1">
            <SolutionMapping selectedChallenges={selectedChallenges} />
          </div>
        </div>
      </div>
    </div>
  );
};