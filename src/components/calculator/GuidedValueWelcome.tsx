import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Target, Calculator, FileText, ArrowRight } from "lucide-react";

interface GuidedValueWelcomeProps {
  open: boolean;
  onClose: () => void;
}

const steps = [
  {
    number: 1,
    icon: Target,
    title: "Discovery & Alignment",
    description: "Identify and align on the customer's priorities and key challenges that the solution will address. This ensures we focus on what matters most to their business.",
  },
  {
    number: 2,
    icon: Calculator,
    title: "Qualify & Quantify Value",
    description: "Evaluate the use cases the solution can support and quantify the potential impact. Deep dive into return on investment (ROI) with detailed financial modeling.",
  },
  {
    number: 3,
    icon: FileText,
    title: "Defendable Value Reports",
    description: "Generate data-backed reports and calculators that clearly demonstrate the value that the solution brings.",
  },
];

export const GuidedValueWelcome = ({ open, onClose }: GuidedValueWelcomeProps) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Welcome to the AI Fraud Prevention Assessment
          </DialogTitle>
          <p className="text-center text-muted-foreground mt-2">
            A structured approach to discovering, quantifying, and communicating customer value
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          {steps.map((step) => (
            <Card 
              key={step.number} 
              className="p-4 border-l-4 border-l-primary hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">{step.number}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <step.icon className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{step.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex justify-center mt-6">
          <Button onClick={onClose} size="lg" className="gap-2">
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
