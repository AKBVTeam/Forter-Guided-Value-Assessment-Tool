import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Calculator, Info, Link2, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Define the benefit options with their challenge mappings
// Labels match the actual calculator names displayed in the UI
export const BENEFIT_OPTIONS = [
  { id: 'c1', label: 'Reduce false declines and approve more transactions', challengeIds: ['1'], category: 'gmv_uplift' as const },
  { id: 'c45', label: 'Optimize payment funnel', challengeIds: ['2', '4', '5'], category: 'gmv_uplift' as const },
  { id: 'chargeback', label: 'Reduce fraud chargebacks', challengeIds: ['1', '2', '4', '5'], category: 'risk_mitigation' as const },
  { id: 'c3', label: 'Reduce manual review workflow', challengeIds: ['3'], category: 'cost_reduction' as const },
  { id: 'c7-revenue', label: 'Increase chargeback recoveries', challengeIds: ['7'], category: 'cost_reduction' as const },
  { id: 'c7-opex', label: 'Improve recovery efficiency (OpEx)', challengeIds: ['7'], category: 'cost_reduction' as const },
  { id: 'c8-returns', label: 'Block/Dissuade returns abusers', challengeIds: ['8'], category: 'risk_mitigation' as const },
  { id: 'c8-inr', label: 'Block INR (Item Not Received) abusers', challengeIds: ['8'], category: 'risk_mitigation' as const },
  { id: 'c9', label: 'Instant refunds CX uplift', challengeIds: ['9'], category: 'gmv_uplift' as const },
  { id: 'c9-cs-opex', label: 'Reduced CS ticket handling', challengeIds: ['9'], category: 'cost_reduction' as const },
  { id: 'c10', label: 'Protect profitability from promotion abuse', challengeIds: ['10', '11'], category: 'risk_mitigation' as const },
  { id: 'c12', label: 'ATO protection OpEx savings', challengeIds: ['12', '13'], category: 'cost_reduction' as const },
  { id: 'c13', label: 'Mitigate customer lifetime value loss from ATO churn', challengeIds: ['12', '13'], category: 'risk_mitigation' as const },
  { id: 'c14-marketing', label: 'Protect marketing budget against duplicate accounts', challengeIds: ['14', '15'], category: 'cost_reduction' as const },
  { id: 'c14-kyc', label: 'Optimize KYC costs', challengeIds: ['14', '15'], category: 'cost_reduction' as const },
];

// Define linked benefit groups - benefits that share the same challenges
export const LINKED_BENEFIT_GROUPS: Record<string, { challengeIds: string[]; benefitIds: string[]; description: string }> = {
  'chargeback': {
    challengeIds: ['7'],
    benefitIds: ['c7-revenue', 'c7-opex'],
    description: 'Chargeback Recovery benefits (Revenue + OpEx savings)',
  },
  'policy-abuse': {
    challengeIds: ['8'],
    benefitIds: ['c8-returns', 'c8-inr'],
    description: 'Policy Abuse benefits (Returns abuse + INR fraud)',
  },
  'promotions': {
    challengeIds: ['10', '11'],
    benefitIds: ['c10'],
    description: 'Promotions Abuse benefits',
  },
  'ato': {
    challengeIds: ['12', '13'],
    benefitIds: ['c12', 'c13'],
    description: 'ATO Protection benefits (OpEx + CLV protection)',
  },
  'signup': {
    challengeIds: ['14', '15'],
    benefitIds: ['c14-marketing', 'c14-kyc'],
    description: 'New Customer Verification benefits (Marketing + KYC)',
  },
  // Instant refunds - CX uplift and CS OpEx are linked
  'instant-refunds': {
    challengeIds: ['9'],
    benefitIds: ['c9', 'c9-cs-opex'],
    description: 'Instant Refunds benefits (CX uplift + CS OpEx savings)',
  },
  // Note: c1, c45, and chargeback are now decoupled - they can be added standalone
  // Users will see a warning tooltip suggesting the associated calculator instead
};

// Find linked benefits for a given benefit
export const getLinkedBenefits = (benefitId: string): { group: string; linkedBenefitIds: string[]; description: string } | null => {
  for (const [groupKey, group] of Object.entries(LINKED_BENEFIT_GROUPS)) {
    if (group.benefitIds.includes(benefitId)) {
      // Return other benefits in the same group (excluding the one being added)
      const linkedBenefitIds = group.benefitIds.filter(id => id !== benefitId);
      if (linkedBenefitIds.length > 0) {
        return { group: groupKey, linkedBenefitIds, description: group.description };
      }
    }
  }
  return null;
};

interface BenefitSelectorProps {
  selectedChallenges: { [key: string]: boolean };
  onAddBenefit: (challengeIds: string[], benefitId: string) => void;
  onRemoveBenefit?: (benefitId: string) => void; // Optional callback to remove conflicting benefits
  onReplaceBenefit?: (removeBenefitId: string, addBenefitId: string, addChallengeIds: string[]) => void; // Combined replace operation
  enabledBenefitIds?: Set<string>;
}

export const BenefitSelector = ({ selectedChallenges, onAddBenefit, onRemoveBenefit, onReplaceBenefit, enabledBenefitIds = new Set() }: BenefitSelectorProps) => {
  const [selectedBenefit, setSelectedBenefit] = useState<string>("");
  const [showLinkedBenefitsDialog, setShowLinkedBenefitsDialog] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingBenefit, setPendingBenefit] = useState<{ id: string; challengeIds: string[] } | null>(null);
  const [linkedBenefitsInfo, setLinkedBenefitsInfo] = useState<{ linkedBenefitIds: string[]; description: string } | null>(null);
  const [conflictingBenefitId, setConflictingBenefitId] = useState<string | null>(null);

  // Filter out benefits that are already added (check enabledBenefitIds for specific benefit tracking)
  const availableBenefits = BENEFIT_OPTIONS.filter(benefit => {
    // Check if this specific benefit ID is already enabled
    if (enabledBenefitIds.has(benefit.id)) {
      return false;
    }
    return true;
  });

  const handleAddBenefit = () => {
    if (!selectedBenefit) return;
    
    const benefit = BENEFIT_OPTIONS.find(b => b.id === selectedBenefit);
    if (!benefit) return;

    // Check for mutual exclusivity: c1 and c45 cannot both be enabled
    const mutuallyExclusiveBenefits: Record<string, string> = {
      'c1': 'c45',
      'c45': 'c1',
    };
    
    const conflictingId = mutuallyExclusiveBenefits[benefit.id];
    if (conflictingId && enabledBenefitIds.has(conflictingId)) {
      // Show conflict warning dialog
      setPendingBenefit({ id: benefit.id, challengeIds: benefit.challengeIds });
      setConflictingBenefitId(conflictingId);
      setShowConflictDialog(true);
      return;
    }

    // Check if this benefit has linked benefits
    // Note: c1, c45, and chargeback are decoupled - they can be added standalone
    // Users will see a warning message suggesting the associated calculator instead
    const linked = getLinkedBenefits(benefit.id);
    
    if (linked && linked.linkedBenefitIds.length > 0) {
      // Check which linked benefits are not yet added
      const availableLinkedBenefits = linked.linkedBenefitIds.filter(
        id => !enabledBenefitIds.has(id)
      );
      
      if (availableLinkedBenefits.length > 0) {
        // Show confirmation dialog (for all benefits including payment calculators)
        setPendingBenefit({ id: benefit.id, challengeIds: benefit.challengeIds });
        setLinkedBenefitsInfo({ linkedBenefitIds: availableLinkedBenefits, description: linked.description });
        setShowLinkedBenefitsDialog(true);
        return;
      }
    }
    
    // No linked benefits or all already added - just add this one
    onAddBenefit(benefit.challengeIds, benefit.id);
    setSelectedBenefit("");
  };

  const handleAddJustOne = () => {
    if (pendingBenefit) {
      onAddBenefit(pendingBenefit.challengeIds, pendingBenefit.id);
    }
    setShowLinkedBenefitsDialog(false);
    setPendingBenefit(null);
    setLinkedBenefitsInfo(null);
    setSelectedBenefit("");
  };

  const handleAddAllLinked = () => {
    if (pendingBenefit && linkedBenefitsInfo) {
      // First add the selected benefit
      onAddBenefit(pendingBenefit.challengeIds, pendingBenefit.id);
      
      // Then add all linked benefits
      linkedBenefitsInfo.linkedBenefitIds.forEach(linkedId => {
        const linkedBenefit = BENEFIT_OPTIONS.find(b => b.id === linkedId);
        if (linkedBenefit) {
          // Use a small delay between each to allow state updates
          setTimeout(() => {
            onAddBenefit(linkedBenefit.challengeIds, linkedBenefit.id);
          }, 50);
        }
      });
    }
    setShowLinkedBenefitsDialog(false);
    setPendingBenefit(null);
    setLinkedBenefitsInfo(null);
    setSelectedBenefit("");
  };

  const handleCancel = () => {
    setShowLinkedBenefitsDialog(false);
    setShowConflictDialog(false);
    setPendingBenefit(null);
    setLinkedBenefitsInfo(null);
    setConflictingBenefitId(null);
  };

  const handleConfirmReplace = () => {
    if (pendingBenefit && conflictingBenefitId) {
      // Use combined replace function if available, otherwise fall back to separate calls
      if (onReplaceBenefit) {
        onReplaceBenefit(conflictingBenefitId, pendingBenefit.id, pendingBenefit.challengeIds);
      } else {
        // Fallback: Remove the conflicting benefit first, then add the new benefit
        if (onRemoveBenefit) {
          onRemoveBenefit(conflictingBenefitId);
        }
        // Use setTimeout to ensure removal completes before addition
        setTimeout(() => {
          onAddBenefit(pendingBenefit.challengeIds, pendingBenefit.id);
        }, 100);
      }
    }
    setShowConflictDialog(false);
    setPendingBenefit(null);
    setConflictingBenefitId(null);
    setSelectedBenefit("");
  };

  // Get labels for the linked benefits
  const getLinkedBenefitLabels = (): string[] => {
    if (!linkedBenefitsInfo) return [];
    return linkedBenefitsInfo.linkedBenefitIds
      .map(id => BENEFIT_OPTIONS.find(b => b.id === id)?.label)
      .filter((label): label is string => !!label);
  };

  const selectedBenefitLabel = pendingBenefit 
    ? BENEFIT_OPTIONS.find(b => b.id === pendingBenefit.id)?.label 
    : '';

  // Get associated calculator suggestion for payment calculators
  const getAssociatedCalculatorSuggestion = (benefitId: string): { label: string; id: string } | null => {
    if (benefitId === 'c1') {
      return { label: 'Reduce fraud chargebacks', id: 'chargeback' };
    }
    if (benefitId === 'c45') {
      return { label: 'Reduce fraud chargebacks', id: 'chargeback' };
    }
    if (benefitId === 'chargeback') {
      // Suggest c1 or c45 based on what's available
      if (!enabledBenefitIds.has('c1') && !enabledBenefitIds.has('c45')) {
        return { label: 'Reduce false declines and approve more transactions', id: 'c1' };
      }
      if (enabledBenefitIds.has('c1')) {
        return null; // Already has c1
      }
      if (enabledBenefitIds.has('c45')) {
        return null; // Already has c45
      }
    }
    return null;
  };

  const associatedSuggestion = selectedBenefit ? getAssociatedCalculatorSuggestion(selectedBenefit) : null;
  const showSuggestion = associatedSuggestion && !enabledBenefitIds.has(associatedSuggestion.id);

  return (
    <>
      <Card className="p-4 border-dashed border-2 border-primary/30 bg-primary/5">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Add Standard Benefit Calculator</span>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Select a benefit to add its calculator. All inputs will start at 0 - fill them in manually or via the calculator modal.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Select value={selectedBenefit} onValueChange={setSelectedBenefit}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a benefit calculator to add..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>GMV Uplift</SelectLabel>
                  {availableBenefits
                    .filter(b => b.category === 'gmv_uplift')
                    .map(benefit => {
                      return (
                        <SelectItem key={benefit.id} value={benefit.id}>
                          {benefit.label}
                        </SelectItem>
                      );
                    })}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Cost Reduction</SelectLabel>
                  {availableBenefits
                    .filter(b => b.category === 'cost_reduction')
                    .map(benefit => {
                      return (
                        <SelectItem key={benefit.id} value={benefit.id}>
                          {benefit.label}
                        </SelectItem>
                      );
                    })}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Risk Mitigation</SelectLabel>
                  {availableBenefits
                    .filter(b => b.category === 'risk_mitigation')
                    .map(benefit => {
                      return (
                        <SelectItem key={benefit.id} value={benefit.id}>
                          {benefit.label}
                        </SelectItem>
                      );
                    })}
                </SelectGroup>
              </SelectContent>
            </Select>
            {showSuggestion && (
              <Alert className="mt-3 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Consider adding:</strong> "{associatedSuggestion.label}" is an associated calculator that shares the same underlying inputs. You can add it separately from the dropdown if needed.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <Button 
            onClick={handleAddBenefit} 
            disabled={!selectedBenefit}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
        {availableBenefits.length === 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            All standard benefit calculators have been added.
          </p>
        )}
      </Card>

      {/* Linked Benefits Confirmation Dialog */}
      <AlertDialog open={showLinkedBenefitsDialog} onOpenChange={setShowLinkedBenefitsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Associated Benefits Available
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  The benefit "{selectedBenefitLabel}" has associated benefits that share the same underlying inputs:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {getLinkedBenefitLabels().map((label, i) => (
                    <li key={i} className="text-foreground">{label}</li>
                  ))}
                </ul>
                <p className="text-sm">
                  Would you like to add all associated benefits together, or just the one you selected?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleCancel}>
              Cancel
            </AlertDialogCancel>
            <Button variant="outline" onClick={handleAddJustOne}>
              Add Just This One
            </Button>
            <Button onClick={handleAddAllLinked}>
              Add All Associated
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conflict Warning Dialog */}
      <AlertDialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-amber-500" />
              Replace Existing Calculator?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You already have "{BENEFIT_OPTIONS.find(b => b.id === conflictingBenefitId)?.label || conflictingBenefitId}" enabled.
                </p>
                <p className="text-sm">
                  "{selectedBenefitLabel}" and "{BENEFIT_OPTIONS.find(b => b.id === conflictingBenefitId)?.label || conflictingBenefitId}" are mutually exclusive. Only one can be active at a time.
                </p>
                <p className="text-sm font-medium">
                  Adding "{selectedBenefitLabel}" will remove "{BENEFIT_OPTIONS.find(b => b.id === conflictingBenefitId)?.label || conflictingBenefitId}" and replace it.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleCancel}>
              Cancel
            </AlertDialogCancel>
            <Button onClick={handleConfirmReplace} variant="destructive">
              Replace
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
