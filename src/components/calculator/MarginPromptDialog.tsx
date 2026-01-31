import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumericInput } from "./NumericInput";
import { AlertCircle } from "lucide-react";

interface MarginPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grossMarginPercent?: number;
  isMarketplace?: boolean;
  commissionRate?: number;
  onSave: (grossMargin: number, isMarketplace: boolean, commissionRate?: number) => void;
  onSkip?: () => void;
}

export const MarginPromptDialog = ({
  open,
  onOpenChange,
  grossMarginPercent,
  isMarketplace,
  commissionRate,
  onSave,
  onSkip,
}: MarginPromptDialogProps) => {
  const [localGrossMargin, setLocalGrossMargin] = useState<number>(grossMarginPercent ?? 50);
  const [localIsMarketplace, setLocalIsMarketplace] = useState<boolean>(isMarketplace ?? false);
  const [localCommissionRate, setLocalCommissionRate] = useState<number>(commissionRate ?? 15);

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalGrossMargin(grossMarginPercent ?? 50);
      setLocalIsMarketplace(isMarketplace ?? false);
      setLocalCommissionRate(commissionRate ?? 15);
    }
  }, [open, grossMarginPercent, isMarketplace, commissionRate]);

  const handleSave = () => {
    onSave(localGrossMargin, localIsMarketplace, localIsMarketplace ? localCommissionRate : undefined);
    onOpenChange(false);
  };

  const handleSkip = () => {
    onSkip?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Additional Information Needed
          </DialogTitle>
          <DialogDescription>
            To calculate the EBITDA contribution from GMV, we need to know your business model and margin.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="business-model">Business Model</Label>
            <Select
              value={localIsMarketplace ? "marketplace" : "retailer"}
              onValueChange={(value) => setLocalIsMarketplace(value === "marketplace")}
            >
              <SelectTrigger id="business-model">
                <SelectValue placeholder="Select business model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retailer">Retailer (Direct Sales)</SelectItem>
                <SelectItem value="marketplace">Marketplace</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {localIsMarketplace 
                ? "Revenue is calculated as GMV × Commission Rate × Gross Margin"
                : "Revenue is calculated as GMV × Gross Margin"}
            </p>
          </div>

          {localIsMarketplace && (
            <div className="space-y-2">
              <Label htmlFor="commission-rate">Commission / Take Rate (%)</Label>
              <NumericInput
                value={localCommissionRate}
                onChange={(v) => setLocalCommissionRate(v ?? 15)}
                placeholder="15"
              />
              <p className="text-xs text-muted-foreground">
                The percentage of each transaction the customer retains as commission
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="gross-margin">Gross Margin (%)</Label>
            <NumericInput
              value={localGrossMargin}
              onChange={(v) => setLocalGrossMargin(v ?? 50)}
              placeholder="50"
            />
            <p className="text-xs text-muted-foreground">
              The customer's gross profit margin after cost of goods sold
            </p>
          </div>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {onSkip && (
            <Button variant="ghost" onClick={handleSkip}>
              Skip for now
            </Button>
          )}
          <Button onClick={handleSave}>
            Save & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};