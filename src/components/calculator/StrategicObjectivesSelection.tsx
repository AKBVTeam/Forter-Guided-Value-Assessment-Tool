import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  TrendingUp, 
  Users, 
  Zap, 
  PiggyBank, 
  Shield,
  ChevronRight,
  ChevronLeft,
  Check,
  RotateCcw,
  Calculator,
  ExternalLink,
} from "lucide-react";
import { 
  STRATEGIC_OBJECTIVES, 
  USE_CASES, 
  getUseCasesForObjectives,
  getChallengeIdsFromUseCases,
  challengeIdsToSelection,
  getUseCaseIdsFromChallenges,
  StrategicObjectiveId,
  UseCase,
} from "@/lib/useCaseMapping";
import { SolutionMapping } from "./SolutionMapping";
import { getChallengeBenefitContent, ChallengeBenefitContent } from "@/lib/challengeBenefitContent";

const iconMap: { [key: string]: React.ElementType } = {
  TrendingUp,
  Users,
  Zap,
  PiggyBank,
  Shield,
};

// Map use case IDs to calculator IDs for popup modals
const USE_CASE_TO_CALCULATOR_IDS: Record<string, string[]> = {
  'reduce_false_declines': ['c1-revenue', 'c1-chargeback'],
  'dynamic_checkout': ['c245-revenue', 'c245-chargeback'],
  'automate_fraud_operations': ['c3-review'],
  'smarter_3ds': ['c245-revenue', 'c245-chargeback'],
  'intelligent_routing': [], // Not in GVA yet
  'chargeback_recovery': ['c7-disputes', 'c7-opex'],
  'policy_integrity': ['c8-returns', 'c8-inr'],
  'instant_refunds': ['c9-cx-uplift', 'c9-cs-opex'],
  'promotion_optimization': ['c10-promotions'],
  'loyalty_protection': ['c12-ato-opex', 'c13-clv'],
  'new_customer_verification': ['c14-marketing', 'c14-reactivation', 'c14-kyc'],
};

interface StrategicObjectivesSelectionProps {
  selectedChallenges: { [key: string]: boolean };
  onChallengeChange: (challengeId: string, checked: boolean) => void;
  onBulkChallengeChange: (challenges: { [key: string]: boolean }) => void;
  onBack: () => void;
  onChangePath: () => void;
  selectedObjectives: StrategicObjectiveId[];
  onObjectivesChange: (objectives: StrategicObjectiveId[]) => void;
  step: 'objectives' | 'usecases';
  onStepChange: (step: 'objectives' | 'usecases') => void;
}

export const StrategicObjectivesSelection = ({
  selectedChallenges,
  onChallengeChange,
  onBulkChallengeChange,
  onBack,
  onChangePath,
  selectedObjectives,
  onObjectivesChange,
  step,
  onStepChange,
}: StrategicObjectivesSelectionProps) => {
  // Derive selected use cases from selected challenges (for persistence)
  const derivedSelectedUseCases = getUseCaseIdsFromChallenges(selectedChallenges);
  
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>(derivedSelectedUseCases);
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null);
  const [modalTab, setModalTab] = useState<'summary' | 'benefits'>('summary');

  // Sync selectedUseCases with derivedSelectedUseCases when challenges change externally
  useEffect(() => {
    setSelectedUseCases(derivedSelectedUseCases);
  }, [JSON.stringify(derivedSelectedUseCases)]);

  // Get filtered use cases based on selected objectives
  const filteredUseCases = getUseCasesForObjectives(selectedObjectives);

  // Get benefit content for the selected use case
  const useCaseBenefitContent = useMemo(() => {
    if (!selectedUseCase) return [];
    const calculatorIds = USE_CASE_TO_CALCULATOR_IDS[selectedUseCase.id] || [];
    return calculatorIds
      .map(id => getChallengeBenefitContent(id))
      .filter((c): c is ChallengeBenefitContent => c !== undefined);
  }, [selectedUseCase]);

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

  const handleUseCaseInfoClick = (e: React.MouseEvent, useCase: UseCase) => {
    e.stopPropagation();
    setSelectedUseCase(useCase);
    setModalTab('summary');
  };

  const handleSelectAllUseCases = () => {
    if (selectedUseCases.length === filteredUseCases.length) {
      // Deselect all
      const challengeIds = getChallengeIdsFromUseCases([]);
      onBulkChallengeChange(challengeIdsToSelection(challengeIds));
      setSelectedUseCases([]);
    } else {
      // Select all filtered use cases
      const allIds = filteredUseCases.map(uc => uc.id);
      const challengeIds = getChallengeIdsFromUseCases(allIds);
      const newChallenges = { ...selectedChallenges, ...challengeIdsToSelection(challengeIds) };
      onBulkChallengeChange(newChallenges);
      setSelectedUseCases(allIds);
    }
  };

  const handleContinueToUseCases = () => {
    onStepChange('usecases');
  };

  const handleBackToObjectives = () => {
    onStepChange('objectives');
  };

  // Count selected challenges
  const selectedChallengeCount = Object.values(selectedChallenges).filter(Boolean).length;

  if (step === 'objectives') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Strategic Objectives</h3>
            <p className="text-sm text-muted-foreground">
              Select prospect priorities to filter relevant use cases
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onChangePath}
              className="text-muted-foreground"
            >
              <RotateCcw className="w-4 h-4 mr-1" /> Change Path
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSelectAllObjectives}
            >
              {selectedObjectives.length === STRATEGIC_OBJECTIVES.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {STRATEGIC_OBJECTIVES.map((objective) => {
            const Icon = iconMap[objective.icon] || Shield;
            const isSelected = selectedObjectives.includes(objective.id);

            return (
              <Card
                key={objective.id}
                className={`p-4 cursor-pointer transition-all ${
                  isSelected 
                    ? 'border-primary bg-primary/5 shadow-md' 
                    : 'hover:border-primary/30 hover:shadow-sm'
                }`}
                onClick={() => handleObjectiveToggle(objective.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{objective.name}</h4>
                      {isSelected && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{objective.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          <Button 
            onClick={handleContinueToUseCases} 
            disabled={selectedObjectives.length === 0}
            className="gap-2"
          >
            Continue to Use Cases <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Use Cases step
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Select Use Cases</h3>
          <p className="text-sm text-muted-foreground">
            {filteredUseCases.length} use cases available based on selected objectives
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onChangePath}
            className="text-muted-foreground"
          >
            <RotateCcw className="w-4 h-4 mr-1" /> Change Path
          </Button>
          {selectedChallengeCount > 0 && (
            <Badge variant="default" className="text-xs">
              {selectedChallengeCount} selected
            </Badge>
          )}
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSelectAllUseCases}
          >
            {selectedUseCases.length === filteredUseCases.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Use Cases list - takes 2 columns */}
        <div className="lg:col-span-2 space-y-3">
          {filteredUseCases.map((useCase) => {
            const isSelected = selectedUseCases.includes(useCase.id);
            const hasCalculators = (USE_CASE_TO_CALCULATOR_IDS[useCase.id] || []).length > 0;

            return (
              <Card
                key={useCase.id}
                className={`p-4 cursor-pointer transition-all ${
                  isSelected 
                    ? 'border-primary bg-primary/5' 
                    : 'hover:border-primary/30'
                }`}
                onClick={() => handleUseCaseToggle(useCase.id)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleUseCaseToggle(useCase.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{useCase.name}</h4>
                      {hasCalculators && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleUseCaseInfoClick(e, useCase)}
                          className="text-muted-foreground hover:text-foreground gap-1 h-7 px-2"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                          <span className="text-xs">View Benefits</span>
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{useCase.description}</p>
                  </div>
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

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={handleBackToObjectives} className="gap-2">
          <ChevronLeft className="w-4 h-4" /> Back to Objectives
        </Button>
        <div />
      </div>

      {/* Benefit Summary Modal */}
      <Dialog open={selectedUseCase !== null} onOpenChange={() => setSelectedUseCase(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedUseCase?.name}</DialogTitle>
            <DialogDescription>
              {selectedUseCase?.description}
            </DialogDescription>
          </DialogHeader>

          {useCaseBenefitContent.length > 0 ? (
            <Tabs value={modalTab} onValueChange={(v) => setModalTab(v as 'summary' | 'benefits')} className="mt-4">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="summary">Overview</TabsTrigger>
                <TabsTrigger value="benefits">Challenges & Benefits</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Strategic Alignment</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedUseCase?.strategicObjectives.map(objId => {
                        const obj = STRATEGIC_OBJECTIVES.find(o => o.id === objId);
                        if (!obj) return null;
                        const Icon = iconMap[obj.icon] || Shield;
                        return (
                          <Badge key={objId} variant="secondary" className="gap-1">
                            <Icon className="w-3 h-3" />
                            {obj.name}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Value Drivers ({useCaseBenefitContent.length})</h4>
                    <div className="grid gap-3">
                      {useCaseBenefitContent.map((content, idx) => (
                        <Card key={idx} className="p-4">
                          <h5 className="font-medium text-primary">{content.benefitTitle}</h5>
                          <p className="text-sm text-muted-foreground mt-1">{content.benefitDescription}</p>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="benefits" className="space-y-6 mt-4">
                {useCaseBenefitContent.map((content, idx) => (
                  <div key={idx} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Challenge */}
                      <Card className="p-4 border-destructive/30 bg-destructive/5">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="destructive" className="text-xs">Challenge</Badge>
                        </div>
                        <h5 className="font-semibold mb-2">{content.challengeTitle}</h5>
                        <p className="text-sm text-muted-foreground">{content.challengeDescription}</p>
                      </Card>

                      {/* Benefit */}
                      <Card className="p-4 border-primary/30 bg-primary/5">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="text-xs">Benefit</Badge>
                        </div>
                        <h5 className="font-semibold mb-2">{content.benefitTitle}</h5>
                        <p className="text-sm text-muted-foreground">{content.benefitDescription}</p>
                        {content.benefitPoints && content.benefitPoints.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {content.benefitPoints.map((point, pIdx) => (
                              <div key={pIdx} className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                <div>
                                  <span className="font-medium text-sm">{point.title}:</span>
                                  <span className="text-sm text-muted-foreground ml-1">{point.description}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    </div>
                    {idx < useCaseBenefitContent.length - 1 && <hr className="border-border" />}
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <p>No detailed benefit information available for this use case yet.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};