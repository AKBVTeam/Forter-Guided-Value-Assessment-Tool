import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumericInput } from "./NumericInput";
import { Settings2 } from "lucide-react";

export interface AbuseBenchmarks {
  // Egregious abuse assumptions only (general model assumptions moved to main KPI page)
  egregiousReturnsAbusePct: number;
  egregiousInventoryLossPct: number;
  egregiousINRAbusePct: number;
  nonEgregiousReturnsAbusePct: number;
  nonEgregiousInventoryLossPct: number;
  forterEgregiousReturnsReduction: number;
  forterEgregiousINRReduction: number;
  forterNonEgregiousReturnsReduction: number;
  // Promotions abuse (Challenge 10)
  promotionAbuseAsGMVPct: number;
}

export const defaultAbuseBenchmarks: AbuseBenchmarks = {
  egregiousReturnsAbusePct: 2,
  egregiousInventoryLossPct: 100,
  egregiousINRAbusePct: 15,
  nonEgregiousReturnsAbusePct: 8,
  nonEgregiousInventoryLossPct: 50,
  forterEgregiousReturnsReduction: 90,
  forterEgregiousINRReduction: 90,
  forterNonEgregiousReturnsReduction: 90,
  // Promotions abuse default
  promotionAbuseAsGMVPct: 2,
};

interface AbuseBenchmarksModalProps {
  benchmarks: AbuseBenchmarks;
  onUpdate: (benchmarks: AbuseBenchmarks) => void;
}

export const AbuseBenchmarksModal = ({ benchmarks, onUpdate }: AbuseBenchmarksModalProps) => {
  const [open, setOpen] = useState(false);
  const [localBenchmarks, setLocalBenchmarks] = useState<AbuseBenchmarks>(benchmarks);

  const updateField = (field: keyof AbuseBenchmarks, value: number) => {
    setLocalBenchmarks(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(localBenchmarks);
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setLocalBenchmarks(benchmarks);
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="w-4 h-4" />
          Advanced Abuse Assumptions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Advanced Abuse Assumptions</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Egregious Abuse Assumptions */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Egregious Abuse Assumptions
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Returns Abuse (% of returns)</Label>
                <NumericInput
                  value={localBenchmarks.egregiousReturnsAbusePct}
                  onChange={(v) => updateField("egregiousReturnsAbusePct", v)}
                  placeholder="2"
                />
              </div>
              <div className="space-y-2">
                <Label>Inventory Lost on Returns Abuse (%)</Label>
                <NumericInput
                  value={localBenchmarks.egregiousInventoryLossPct}
                  onChange={(v) => updateField("egregiousInventoryLossPct", v)}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label>INR Abuse (% of INR claims)</Label>
                <NumericInput
                  value={localBenchmarks.egregiousINRAbusePct}
                  onChange={(v) => updateField("egregiousINRAbusePct", v)}
                  placeholder="15"
                />
              </div>
              <div className="space-y-2">
                <Label>Forter Egregious Returns Reduction (%)</Label>
                <NumericInput
                  value={localBenchmarks.forterEgregiousReturnsReduction}
                  onChange={(v) => updateField("forterEgregiousReturnsReduction", v)}
                  placeholder="90"
                />
              </div>
              <div className="space-y-2">
                <Label>Forter INR Reduction (%)</Label>
                <NumericInput
                  value={localBenchmarks.forterEgregiousINRReduction}
                  onChange={(v) => updateField("forterEgregiousINRReduction", v)}
                  placeholder="90"
                />
              </div>
            </div>
          </div>

          {/* Non-Egregious Abuse Assumptions */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Non-Egregious Abuse Assumptions
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Returns Abuse (% of returns)</Label>
                <NumericInput
                  value={localBenchmarks.nonEgregiousReturnsAbusePct}
                  onChange={(v) => updateField("nonEgregiousReturnsAbusePct", v)}
                  placeholder="8"
                />
              </div>
              <div className="space-y-2">
                <Label>Inventory Lost on Returns Abuse (%)</Label>
                <NumericInput
                  value={localBenchmarks.nonEgregiousInventoryLossPct}
                  onChange={(v) => updateField("nonEgregiousInventoryLossPct", v)}
                  placeholder="50"
                />
              </div>
              <div className="space-y-2">
                <Label>Forter Non-Egregious Reduction (%)</Label>
                <NumericInput
                  value={localBenchmarks.forterNonEgregiousReturnsReduction}
                  onChange={(v) => updateField("forterNonEgregiousReturnsReduction", v)}
                  placeholder="90"
                />
              </div>
            </div>
          </div>

          {/* Promotions Abuse Assumptions */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Promotions Abuse Assumptions
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Promotion abuse as % of GMV (%)</Label>
                <NumericInput
                  value={localBenchmarks.promotionAbuseAsGMVPct}
                  onChange={(v) => updateField("promotionAbuseAsGMVPct", v)}
                  placeholder="2"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};