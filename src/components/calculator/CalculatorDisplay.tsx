import { Card } from "@/components/ui/card";
import { CalculatorRow } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";

interface CalculatorDisplayProps {
  title: string;
  rows: CalculatorRow[];
  className?: string;
}

const formatForterImprovement = (value: string | undefined) => {
  if (!value) return "";
  let str = String(value).trim();

  // Display as-is: % improvement (no suffix) or % pts for percentage-point improvements
  if (str === "0" || str === "0%" || str === "0.00%" || str === "0.0% pts" || str === "0% pts" || str === "$0" || str === "-$0") {
    return str.replace("-", "");
  }

  if (str.startsWith("+") || (str.startsWith("(") && str.endsWith(")"))) {
    return str;
  }

  if (str.startsWith("-")) {
    return `(${str.slice(1)})`;
  }

  return `+${str}`;
};

const getImprovementTone = (value: string | undefined): "positive" | "negative" | "neutral" => {
  if (!value) return "neutral";
  const str = value.trim();
  if (str.startsWith("-")) return "negative";
  if (str.startsWith("(")) return "negative";
  if (str.startsWith("+")) return "positive";
  if (str === "0" || str === "0%" || str === "0.00%" || str === "0.0% pts" || str === "0% pts" || str === "$0") return "neutral";
  if (str.startsWith("0")) return "neutral";
  return "positive";
};

export const CalculatorDisplay = ({ title, rows, className }: CalculatorDisplayProps) => {
  const getValueDriverBadge = (valueDriver?: "revenue" | "profit" | "cost") => {
    if (!valueDriver) return null;

    const labels = {
      revenue: "Revenue uplift",
      profit: "Profit uplift",
      cost: "Cost reduction",
    };

    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      revenue: "default",
      profit: "secondary",
      cost: "outline",
    };

    return (
      <Badge variant={variants[valueDriver]} className="ml-2 text-xs">
        {labels[valueDriver]}
      </Badge>
    );
  };

  return (
    <Card className={`overflow-hidden ${className ?? ""}`}> 
      <div className="bg-primary/5 border-b px-4 py-3">
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <div className="max-h-[600px] overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="sticky top-0 z-10 bg-background border-b shadow-sm">
            <tr>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-sm w-[100px]">Formula</th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-sm">Description</th>
              <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground text-sm w-[130px]">Customer inputs</th>
              <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground text-sm bg-blue-50 dark:bg-blue-950/30 w-[140px]">Forter improvement</th>
              <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground text-sm w-[120px]">Forter outcome</th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {rows.map((row, index) => {
              // Section headers (rows without formula)
              const isSectionHeader = !row.formula && row.label && !row.customerInput;

              if (isSectionHeader) {
                return (
                  <tr key={index} className="bg-muted/30 border-b">
                    <td colSpan={5} className="p-4 align-middle font-semibold text-sm py-2">
                      {row.label}
                    </td>
                  </tr>
                );
              }

              const improvementText = formatForterImprovement(row.forterImprovement);
              const tone = getImprovementTone(row.forterImprovement);
              const toneClass =
                tone === "negative"
                  ? "text-destructive"
                  : tone === "positive"
                    ? "text-primary"
                    : "";

              // Determine row background: value driver rows get stronger shading, calculation rows get light shading
              const rowBgClass = row.valueDriver 
                ? "bg-primary/10" 
                : row.isCalculation 
                  ? "bg-muted/40" 
                  : "";

              return (
                <tr key={index} className={`border-b transition-colors hover:bg-muted/50 ${rowBgClass}`}>
                  <td className="p-4 align-middle font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {row.formula}
                  </td>
                  <td className="p-4 align-middle text-sm">
                    {row.label}
                    {getValueDriverBadge(row.valueDriver)}
                  </td>
                  <td className="p-4 align-middle text-right text-sm font-medium">
                    {row.customerInput}
                  </td>
                  <td className={`p-4 align-middle text-right text-sm font-medium bg-blue-50 dark:bg-blue-950/30 ${toneClass}`.trim()}>
                    {improvementText}
                  </td>
                  <td className="p-4 align-middle text-right text-sm font-medium">
                    {row.forterOutcome}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
