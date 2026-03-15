import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  TrendingUp, 
  Users, 
  Zap, 
  PiggyBank, 
  Shield,
  Check,
  RotateCcw,
  MousePointerClick,
  Star,
} from "lucide-react";
import { 
  STRATEGIC_OBJECTIVES, 
  getUseCasesForObjectives,
  getChallengeIdsFromUseCases,
  challengeIdsToSelection,
  getUseCaseIdsFromChallenges,
  StrategicObjectiveId,
  USE_CASES,
  isUseCaseRecommendedForPersonas,
} from "@/lib/useCaseMapping";
import { BUYER_PERSONA_PDFS } from "./WhatIsBusinessValueModal";
import { ALL_CHALLENGES } from "@/lib/calculations";
import { SolutionMapping } from "./SolutionMapping";
import { cn } from "@/lib/utils";

const iconMap: { [key: string]: React.ElementType } = {
  TrendingUp,
  Users,
  Zap,
  PiggyBank,
  Shield,
};

interface UnifiedUseCaseSelectionProps {
  selectedChallenges: { [key: string]: boolean };
  onBulkChallengeChange: (challenges: { [key: string]: boolean }) => void;
  onChangePath: () => void;
  selectedObjectives: StrategicObjectiveId[];
  onObjectivesChange: (objectives: StrategicObjectiveId[]) => void;
  /** Selected buyer persona PDF filenames from Profile; used to show recommended use cases */
  selectedBuyerPersonas?: string[];
}

/** Get persona labels from selected PDF filenames (from Profile) */
function getPersonaLabelsFromFilenames(filenames: string[]): string[] {
  const labels: string[] = [];
  const byFilename = new Map(BUYER_PERSONA_PDFS.map((p) => [p.filename, p.label]));
  filenames.forEach((f) => {
    const label = byFilename.get(f);
    if (label) labels.push(label);
  });
  return labels;
}

export const UnifiedUseCaseSelection = ({
  selectedChallenges,
  onBulkChallengeChange,
  onChangePath,
  selectedObjectives,
  onObjectivesChange,
  selectedBuyerPersonas = [],
}: UnifiedUseCaseSelectionProps) => {
  const selectedPersonaLabels = getPersonaLabelsFromFilenames(selectedBuyerPersonas);
  // Derive selected use cases from selected challenges (for persistence)
  const derivedSelectedUseCases = getUseCaseIdsFromChallenges(selectedChallenges);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>(derivedSelectedUseCases);

  // Get filtered use cases based on selected objectives - empty if no objectives selected
  const filteredUseCases = selectedObjectives.length > 0 
    ? getUseCasesForObjectives(selectedObjectives)
    : [];

  const availableUseCaseIds = filteredUseCases.map(uc => uc.id);

  // Sync selectedUseCases with derivedSelectedUseCases when challenges change externally
  useEffect(() => {
    setSelectedUseCases(derivedSelectedUseCases);
  }, [JSON.stringify(derivedSelectedUseCases)]);

  // When objectives change, deselect use cases that are no longer available
  useEffect(() => {
    const unavailableSelectedUseCases = selectedUseCases.filter(
      ucId => !availableUseCaseIds.includes(ucId)
    );
    
    if (unavailableSelectedUseCases.length > 0) {
      // Remove these use cases and their challenges
      const newSelectedUseCases = selectedUseCases.filter(
        ucId => availableUseCaseIds.includes(ucId)
      );
      
      // Update challenges based on remaining use cases
      const challengeIds = getChallengeIdsFromUseCases(newSelectedUseCases);
      const newChallenges = challengeIdsToSelection(challengeIds);
      
      // Merge: keep only challenges from still-selected use cases
      const mergedChallenges = { ...selectedChallenges };
      const allUseCaseChallengeIds = new Set(
        USE_CASES.flatMap(uc => uc.challengeIds)
      );
      Object.keys(mergedChallenges).forEach(id => {
        if (allUseCaseChallengeIds.has(id) && !challengeIds.includes(id)) {
          mergedChallenges[id] = false;
        }
      });
      
      setSelectedUseCases(newSelectedUseCases);
      onBulkChallengeChange(mergedChallenges);
    }
  }, [JSON.stringify(availableUseCaseIds)]);

  const handleObjectiveToggle = (objectiveId: StrategicObjectiveId) => {
    if (selectedObjectives.includes(objectiveId)) {
      onObjectivesChange(selectedObjectives.filter(id => id !== objectiveId));
    } else {
      onObjectivesChange([...selectedObjectives, objectiveId]);
    }
  };

  const handleSelectAllObjectives = () => {
    if (selectedObjectives.length === STRATEGIC_OBJECTIVES.length) {
      onObjectivesChange([]);
    } else {
      onObjectivesChange(STRATEGIC_OBJECTIVES.map(o => o.id));
    }
  };

  const handleUseCaseToggle = (useCaseId: string) => {
    setSelectedUseCases(prev => {
      const newSelection = prev.includes(useCaseId)
        ? prev.filter(id => id !== useCaseId)
        : [...prev, useCaseId];
      
      // Update challenges based on use case selection
      const challengeIds = getChallengeIdsFromUseCases(newSelection);
      const newChallenges = challengeIdsToSelection(challengeIds);
      
      // Merge with existing challenges (additive)
      const mergedChallenges = { ...selectedChallenges };
      Object.keys(newChallenges).forEach(id => {
        mergedChallenges[id] = newChallenges[id];
      });
      
      // Remove challenges that are no longer in any selected use case
      const allUseCaseChallengeIds = new Set(
        USE_CASES.flatMap(uc => uc.challengeIds)
      );
      Object.keys(mergedChallenges).forEach(id => {
        if (allUseCaseChallengeIds.has(id) && !challengeIds.includes(id)) {
          mergedChallenges[id] = false;
        }
      });
      
      onBulkChallengeChange(mergedChallenges);
      return newSelection;
    });
  };

  const handleSelectAllUseCases = () => {
    if (selectedUseCases.length === filteredUseCases.length && filteredUseCases.length > 0) {
      const challengeIds = getChallengeIdsFromUseCases([]);
      onBulkChallengeChange(challengeIdsToSelection(challengeIds));
      setSelectedUseCases([]);
    } else {
      const allIds = filteredUseCases.map(uc => uc.id);
      const challengeIds = getChallengeIdsFromUseCases(allIds);
      const newChallenges = { ...selectedChallenges, ...challengeIdsToSelection(challengeIds) };
      onBulkChallengeChange(newChallenges);
      setSelectedUseCases(allIds);
    }
  };

  const selectedChallengeCount = Object.values(selectedChallenges).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Use Case Discovery</h3>
          <p className="text-sm text-muted-foreground">
            Select objectives to filter use cases, then choose the relevant ones.{" "}
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
            </span>{" "}
            are recommended for the buyer persona.
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onChangePath}
          className="text-muted-foreground"
        >
          <RotateCcw className="w-4 h-4 mr-1" /> Change Path
        </Button>
      </div>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Strategic Objectives */}
        <div>
          <Card className="p-3 h-full">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Strategic Objectives
              </h4>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleSelectAllObjectives}
                className="h-6 text-xs px-2"
              >
                {selectedObjectives.length === STRATEGIC_OBJECTIVES.length ? 'Clear' : 'All'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Select <span className="text-primary font-medium">(multiple selection available)</span>
            </p>
            <ScrollArea className="h-[380px]">
              <div className="space-y-2 pr-2">
                {STRATEGIC_OBJECTIVES.map((objective) => {
                  const Icon = iconMap[objective.icon] || Shield;
                  const isSelected = selectedObjectives.includes(objective.id);

                  return (
                    <div
                      key={objective.id}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01] active:scale-[0.98] ${
                        isSelected 
                          ? 'bg-primary/10 border border-primary/30' 
                          : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                      }`}
                      onClick={() => handleObjectiveToggle(objective.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium truncate">{objective.name}</span>
                            {isSelected && <Check className="w-3 h-3 text-primary flex-shrink-0" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Column 2: Use Cases */}
        <div>
          <Card className="p-3 h-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Use Cases
                </h4>
                {selectedUseCases.length > 0 && (
                  <Badge variant="default" className="text-xs h-5">
                    {selectedUseCases.length} selected
                  </Badge>
                )}
              </div>
              {filteredUseCases.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleSelectAllUseCases}
                  className="h-6 text-xs px-2"
                >
                  {selectedUseCases.length === filteredUseCases.length ? 'Clear' : 'All'}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Select <span className="text-primary font-medium">(multiple selection available)</span>
            </p>
            <ScrollArea className="h-[380px]">
              <div className="space-y-2 pr-2">
                {filteredUseCases.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                      <MousePointerClick className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                      Select strategic objectives first
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use cases will appear here based on selected objectives
                    </p>
                  </div>
                ) : (
                  filteredUseCases.map((useCase) => {
                    const isSelected = selectedUseCases.includes(useCase.id);
                    const isDisabled = useCase.id === 'intelligent_routing';

                    if (isDisabled) {
                      return (
                        <TooltipProvider key={useCase.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="p-3 rounded-lg cursor-not-allowed bg-muted/20 border border-transparent opacity-50"
                              >
                                <div className="flex items-start gap-2">
                                  <Checkbox
                                    checked={false}
                                    disabled
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <h5 className="text-sm font-medium text-muted-foreground">{useCase.name}</h5>
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                      {useCase.description}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Not applicable in GVA</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    }

                    const isRecommended = isUseCaseRecommendedForPersonas(useCase.id, selectedPersonaLabels);
                    return (
                      <div
                        key={useCase.id}
                        className={`p-3 rounded-lg cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01] active:scale-[0.98] relative ${
                          isSelected 
                            ? 'bg-primary/10 border border-primary/30' 
                            : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                        }`}
                        onClick={() => handleUseCaseToggle(useCase.id)}
                      >
                        {isRecommended && (
                          <div className="absolute top-2 right-2 flex items-center justify-center" title="Recommended for your selected buyer persona">
                            <Star className="h-4 w-4 fill-amber-400 text-amber-400 shrink-0" aria-label="Recommended for buyer persona" />
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleUseCaseToggle(useCase.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0 pr-6">
                            <h5 className="text-sm font-medium">{useCase.name}</h5>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {useCase.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Column 3: Solution Mapping (Output - read-only) */}
        <div>
          {(() => {
            const activeSolutions = new Set<string>();
            Object.entries(selectedChallenges).forEach(([challengeId, isSelected]) => {
              if (isSelected) {
                const challenge = ALL_CHALLENGES.find(c => c.id === challengeId);
                if (challenge) challenge.solutionMapping.forEach(s => activeSolutions.add(s));
              }
            });
            const hasAnyActive = activeSolutions.size > 0;
            return (
              <Card className={cn(
                "p-3 h-full border",
                hasAnyActive
                  ? "bg-green-50/90 dark:bg-green-950/40 border-green-200 dark:border-green-800"
                  : "bg-slate-50/80 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700"
              )}>
                <div className="mb-2">
                  <h4 className={cn(
                    "font-semibold text-sm uppercase tracking-wide",
                    hasAnyActive ? "text-green-800 dark:text-green-300" : "text-slate-600 dark:text-slate-400"
                  )}>
                    Solution Mapping
                  </h4>
                </div>
                <p className={cn(
                  "text-xs mb-3",
                  hasAnyActive ? "text-green-700 dark:text-green-400" : "text-slate-500 dark:text-slate-400"
                )}>
                  <span className="font-medium">For reference</span> — Solutions activated by use case selection (read-only)
                </p>
                <SolutionMapping selectedChallenges={selectedChallenges} showCard={false} />
              </Card>
            );
          })()}
        </div>
      </div>
    </div>
  );
};