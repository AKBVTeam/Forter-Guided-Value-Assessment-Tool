import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { ALL_CHALLENGES, ChallengeDefinition } from "@/lib/calculations";
import { isChallengeRecommendedForPersonas } from "@/lib/useCaseMapping";
import { BUYER_PERSONA_PDFS } from "./WhatIsBusinessValueModal";
import { SolutionMapping } from "./SolutionMapping";

interface ChallengeSelectionProps {
  selectedChallenges: { [key: string]: boolean };
  onChallengeChange: (challengeId: string, checked: boolean) => void;
  /** Selected buyer persona PDF filenames from Profile; used to show recommended challenges */
  selectedBuyerPersonas?: string[];
}

function getPersonaLabelsFromFilenames(filenames: string[]): string[] {
  const byFilename = new Map(BUYER_PERSONA_PDFS.map((p) => [p.filename, p.label]));
  return filenames.map((f) => byFilename.get(f)).filter((l): l is string => !!l);
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
  selectedBuyerPersonas = [],
}: ChallengeSelectionProps) => {
  const groupedChallenges = groupByCategory(ALL_CHALLENGES);
  const categories = Object.keys(groupedChallenges);
  const selectedPersonaLabels = getPersonaLabelsFromFilenames(selectedBuyerPersonas);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">
          Customer Challenge Areas
          <span className="text-sm text-muted-foreground ml-2">(select relevant challenges to drive tailored solution package)</span>
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
          </span>{" "}
          are common challenges for the buyer persona.
        </p>
        
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Challenges list - takes 2 columns */}
          <div className="lg:col-span-2 space-y-4">
            {categories.map((category) => {
              const challenges = groupedChallenges[category];
              const hasEnabledChallenges = challenges.some(c => c.enabled);
              
              return (
                <Card key={category} className={`p-4 transition-transform duration-150 ease-out hover:scale-[1.01] ${!hasEnabledChallenges ? 'bg-muted/30' : ''}`}>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    {category}
                    {!hasEnabledChallenges && <span className="text-xs text-muted-foreground">(Coming soon)</span>}
                  </h4>
                  <div className="space-y-2">
                    {challenges.map((challenge) => {
                      const isRecommended = isChallengeRecommendedForPersonas(challenge.id, selectedPersonaLabels);
                      return (
                        <div
                          key={challenge.id}
                          className="flex items-start gap-2 transition-transform duration-150 ease-out active:scale-[0.99] rounded-md -m-1 p-1"
                        >
                          <Checkbox
                            id={`challenge-${challenge.id}`}
                            disabled={!challenge.enabled}
                            checked={selectedChallenges[challenge.id] || false}
                            onCheckedChange={(checked) => onChallengeChange(challenge.id, checked as boolean)}
                            className={!challenge.enabled ? 'opacity-50' : ''}
                          />
                          <Label 
                            htmlFor={`challenge-${challenge.id}`}
                            className={`flex-1 text-sm leading-tight peer-disabled:cursor-not-allowed ${!challenge.enabled ? 'text-muted-foreground opacity-50' : ''}`}
                          >
                            <span className="font-medium mr-1">{challenge.number}.</span>
                            {challenge.name}
                            {!challenge.enabled && <span className="ml-2 text-xs">(WIP)</span>}
                          </Label>
                          {isRecommended && (
                            <Star className="h-4 w-4 fill-amber-400 text-amber-400 shrink-0 mt-0.5" aria-label="Recommended for buyer persona" />
                          )}
                        </div>
                      );
                    })}
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