import { Card } from "@/components/ui/card";
import { TrendingUp, DollarSign, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { CalculationBreakdown } from "./CalculationBreakdown";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";

interface ValueDriver {
  id: string;
  label: string;
  value: number;
  enabled: boolean;
}

interface ValueSummaryProps {
  businessGrowthDrivers: ValueDriver[];
  riskAvoidanceDrivers: ValueDriver[];
  totalValue: number;
  profitValue?: number;
  onDriverClick?: (driverId: string) => void;
  onDriverToggle?: (driverId: string, enabled: boolean) => void;
  showProfitability?: boolean;
  onProfitabilityToggle?: (enabled: boolean) => void;
  grossMarginPercent?: number;
}

export const ValueSummary = ({ 
  businessGrowthDrivers, 
  riskAvoidanceDrivers, 
  totalValue, 
  profitValue,
  onDriverClick,
  onDriverToggle,
  showProfitability = true,
  onProfitabilityToggle,
  grossMarginPercent = 0
}: ValueSummaryProps) => {
  const [businessGrowthOpen, setBusinessGrowthOpen] = useState(true);
  const [riskAvoidanceOpen, setRiskAvoidanceOpen] = useState(true);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const businessGrowthTotal = businessGrowthDrivers.reduce((sum, d) => sum + (d.enabled ? d.value : 0), 0);
  const riskAvoidanceTotal = riskAvoidanceDrivers.reduce((sum, d) => sum + (d.enabled ? d.value : 0), 0);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Left side - Value Drivers */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold mb-4">Explore personalized benefits</h3>
        
        {/* Business Growth Section */}
        <Collapsible open={businessGrowthOpen} onOpenChange={setBusinessGrowthOpen}>
          <Card className="overflow-hidden">
            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                {businessGrowthOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                <span className="font-semibold">Business growths</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t">
                {businessGrowthDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className={`p-4 border-b last:border-b-0 flex items-center justify-between ${
                      !driver.enabled && 'opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Switch
                        checked={driver.enabled}
                        onCheckedChange={(checked) => onDriverToggle?.(driver.id, checked)}
                      />
                      <span 
                        className="text-sm cursor-pointer hover:underline flex-1"
                        onClick={() => driver.enabled && onDriverClick?.(driver.id)}
                      >
                        {driver.label}
                      </span>
                    </div>
                    <span className="font-semibold">{formatCurrency(driver.value)}</span>
                  </div>
                ))}
                <div className="p-4 bg-muted/30 font-semibold flex items-center justify-between">
                  <span>Business growth annual potential</span>
                  <span className="text-foreground font-semibold">{formatCurrency(businessGrowthTotal)}</span>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Risk Avoidance Section */}
        <Collapsible open={riskAvoidanceOpen} onOpenChange={setRiskAvoidanceOpen}>
          <Card className="overflow-hidden">
            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                {riskAvoidanceOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                <span className="font-semibold">Risk Avoidance</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t">
                {riskAvoidanceDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className={`p-4 border-b last:border-b-0 flex items-center justify-between ${
                      !driver.enabled && 'opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Switch
                        checked={driver.enabled}
                        onCheckedChange={(checked) => onDriverToggle?.(driver.id, checked)}
                      />
                      <span 
                        className="text-sm cursor-pointer hover:underline flex-1"
                        onClick={() => driver.enabled && onDriverClick?.(driver.id)}
                      >
                        {driver.label}
                      </span>
                    </div>
                    <span className="font-semibold">{formatCurrency(driver.value)}</span>
                  </div>
                ))}
                <div className="p-4 bg-muted/30 font-semibold flex items-center justify-between">
                  <span>Risk avoidance annual potential</span>
                  <span className="text-foreground font-semibold">{formatCurrency(riskAvoidanceTotal)}</span>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Right side - Summary */}
      <div className="space-y-4">
        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <div className="flex items-start gap-3 mb-4">
            <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-base font-semibold text-foreground mb-1">
                {showProfitability ? 'Annual Profitability Benefit' : 'Annual Revenue Benefit'}
              </p>
              <p className="text-sm text-muted-foreground">
                {showProfitability && grossMarginPercent > 0 ? `(at ${grossMarginPercent.toFixed(0)}% Gross Margin)` : '(probable)'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show Profitability</span>
              <Switch
                checked={showProfitability}
                onCheckedChange={onProfitabilityToggle}
              />
            </div>
          </div>
          <p className="text-5xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(totalValue)}
          </p>
        </Card>
      </div>
    </div>
  );
};
