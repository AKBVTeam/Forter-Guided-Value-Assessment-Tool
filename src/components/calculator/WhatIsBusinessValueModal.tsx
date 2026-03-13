import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Lightbulb,
  Target,
  BarChart3,
  GitBranch,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Shield,
  FileText,
  Sparkles,
  Users,
  Download,
  CreditCard,
  ShieldCheck,
  ShoppingBag,
  PieChart,
  Cpu,
  LayoutDashboard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const WHAT_IS_BUSINESS_VALUE_STORAGE_KEY = "gva_has_seen_what_is_business_value";

export function getHasSeenWhatIsBusinessValue(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(WHAT_IS_BUSINESS_VALUE_STORAGE_KEY);
}

export function setHasSeenWhatIsBusinessValue(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WHAT_IS_BUSINESS_VALUE_STORAGE_KEY, "true");
}

interface WhatIsBusinessValueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, closing the modal marks it as "seen" for first-time logic */
  markAsSeenOnClose?: boolean;
  /** When set, open with this tab active (e.g. "personas" for Buyer Personas) */
  initialTab?: string;
}

const tabConfig = [
  {
    value: "intro",
    label: "Introduction",
    icon: Lightbulb,
  },
  {
    value: "why",
    label: "Why It Matters",
    icon: Target,
  },
  {
    value: "measure",
    label: "How We Measure",
    icon: BarChart3,
  },
  {
    value: "approach",
    label: "The GVA Approach",
    icon: GitBranch,
  },
  {
    value: "next",
    label: "Next Steps",
    icon: ArrowRight,
  },
  {
    value: "personas",
    label: "Buyer Personas",
    icon: Users,
  },
];

export const BUYER_PERSONA_PDFS: { label: string; filename: string; icon: LucideIcon; jobToBeDone: string }[] = [
  { label: "Payments Director", filename: "Payments Director Persona Card.pdf", icon: CreditCard, jobToBeDone: "Optimize approval rates and payment funnel performance." },
  { label: "Fraud Director", filename: "Fraud Director Persona Card.pdf", icon: ShieldCheck, jobToBeDone: "Reduce fraud loss and chargebacks while protecting revenue." },
  { label: "Digital / e-Commerce Director", filename: "Digital - e-Commerce Director Persona Card.pdf", icon: ShoppingBag, jobToBeDone: "Grow digital revenue and improve customer experience." },
  { label: "Chief Financial Officer", filename: "Chief Financial Officer Persona Card.pdf", icon: PieChart, jobToBeDone: "Deliver measurable ROI and align investment to business outcomes." },
  { label: "Chief Technology Officer", filename: "Chief Technology Officer Persona Card.pdf", icon: Cpu, jobToBeDone: "Simplify fraud tech stack and reduce operational complexity." },
  { label: "Chief Digital Officer", filename: "Chief Digital Officer Persona Card.pdf", icon: LayoutDashboard, jobToBeDone: "Drive digital strategy and cross-functional value from identity solutions." },
];

export function WhatIsBusinessValueModal({
  open,
  onOpenChange,
  markAsSeenOnClose = false,
  initialTab,
}: WhatIsBusinessValueModalProps) {
  const [activeTab, setActiveTab] = useState("intro");

  useEffect(() => {
    if (open && initialTab && tabConfig.some((t) => t.value === initialTab)) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  const handleOpenChange = (next: boolean) => {
    if (!next && markAsSeenOnClose) {
      setHasSeenWhatIsBusinessValue();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-4xl w-[min(95vw,56rem)] h-[85vh] min-h-[420px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden"
        hideCloseButton={false}
      >
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            What is the Guided Value Assessment?
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            A short overview of how we define, measure, and communicate value in the GVA
          </p>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0 basis-0 overflow-hidden"
        >
          <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 px-6 h-11 shrink-0 flex-shrink-0 flex-wrap sm:flex-nowrap overflow-x-auto">
            {tabConfig.map((tab, i) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="gap-1.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                <tab.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="flex-1 min-h-0 overflow-auto">
            <TabsContent
              value="intro"
              className="mt-0 px-6 py-5 data-[state=inactive]:hidden focus:outline-none"
            >
              <div className="space-y-4 animate-in fade-in-50 duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Lightbulb className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Definition</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Business value</strong> is the measurable benefit that a solution delivers to an organization, whether through increased revenue, reduced costs, risk mitigation, or improved customer experience. In the context of Forter, it’s the tangible impact of addressing fraud, abuse, and payment friction.
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm text-foreground">
                    This Guided Value Assessment (GVA) helps you and your customer align on <em>what</em> value means for their business, <em>where</em> it comes from (use cases and drivers), and <em>how much</em> of it Forter can help capture, in a format that’s easy to defend in internal discussions.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="why"
              className="mt-0 px-6 py-5 data-[state=inactive]:hidden focus:outline-none"
            >
              <div className="space-y-4 animate-in fade-in-50 duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Strategic context</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Quantifying business value isn’t just about numbers; it’s about aligning stakeholders (security, finance, product, CX) around a shared story. A clear value narrative speeds up decisions and helps secure budget and sponsorship.
                    </p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {[
                    "Build consensus on priorities and expected outcomes",
                    "Create a defensible business case for investment",
                    "Set the stage for ongoing value tracking post-deployment",
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-sm text-muted-foreground animate-in slide-in-from-left-4 duration-300"
                      style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
                    >
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>

            <TabsContent
              value="measure"
              className="mt-0 px-6 py-5 data-[state=inactive]:hidden focus:outline-none"
            >
              <div className="space-y-4 animate-in fade-in-50 duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">How we quantify value</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      We express business value in terms that finance and leadership care about: <strong>EBITDA impact</strong>, <strong>revenue uplift</strong>, <strong>cost reduction</strong>, and <strong>risk mitigation</strong>. Each benefit driver in the GVA ties back to one of these categories.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: TrendingUp, label: "Revenue uplift", desc: "Recovered GMV, approval rate gains" },
                    { icon: Shield, label: "Cost reduction", desc: "Fewer chargebacks, less manual review" },
                    { icon: FileText, label: "Risk mitigation", desc: "Fraud loss, abuse, disputes" },
                  ].map(({ icon: Icon, label, desc }, i) => (
                    <div
                      key={label}
                      className={cn(
                        "rounded-lg border p-3 transition-all hover:border-primary/40 hover:bg-muted/30",
                        "animate-in fade-in-50 duration-300"
                      )}
                      style={{ animationDelay: `${(i + 1) * 60}ms`, animationFillMode: "backwards" }}
                    >
                      <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                        <Icon className="h-4 w-4 text-primary" />
                        {label}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="approach"
              className="mt-0 px-6 py-5 data-[state=inactive]:hidden focus:outline-none"
            >
              <div className="space-y-4 animate-in fade-in-50 duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <GitBranch className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">The GVA methodology</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      The Guided Value Assessment follows a simple flow: <strong>discover</strong> use cases and challenges, <strong>quantify</strong> value with customer inputs and Forter assumptions, and <strong>report</strong> with summaries and ROI that stakeholders can use.
                    </p>
                  </div>
                </div>
                <ol className="space-y-3 list-none pl-0">
                  {[
                    { step: 1, title: "Discovery & alignment", body: "Select use cases and strategic objectives; align on which challenges Forter will address." },
                    { step: 2, title: "Qualify & quantify", body: "Enter customer metrics and Forter KPIs; the tool calculates benefit drivers and EBITDA impact." },
                    { step: 3, title: "Value summary & ROI", body: "Review value by driver, add investment assumptions, and see ROI and payback." },
                    { step: 4, title: "Defendable reports", body: "Generate PowerPoint or Word reports to share and defend the business case." },
                  ].map(({ step, title, body }, i) => (
                    <li
                      key={step}
                      className="flex gap-3 animate-in slide-in-from-left-4 duration-300"
                      style={{ animationDelay: `${i * 70}ms`, animationFillMode: "backwards" }}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {step}
                      </span>
                      <div>
                        <p className="font-medium text-sm text-foreground">{title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </TabsContent>

            <TabsContent
              value="next"
              className="mt-0 px-6 py-5 data-[state=inactive]:hidden focus:outline-none"
            >
              <div className="space-y-4 animate-in fade-in-50 duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ArrowRight className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">How to use this tool</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Start with <strong>Profile</strong> and <strong>Use Cases</strong> to set the scope. Then fill in <strong>Customer Inputs</strong> and <strong>Forter KPI</strong> assumptions (selected Forter KPIs are defaulted to Forter benchmarks automatically). The <strong>Value Summary</strong> and <strong>ROI</strong> tabs bring everything together. You can revisit this overview anytime via the link below the “Analysis last updated” line.
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm text-foreground">
                    <strong>Tip:</strong> Work through the tabs in order for the best experience. Value Summary and ROI unlock after you’ve selected use cases and (for ROI) viewed the Value Summary at least once.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="personas"
              className="mt-0 px-6 py-5 data-[state=inactive]:hidden focus:outline-none"
            >
              <div className="space-y-4 animate-in fade-in-50 duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Buyer Persona Cards</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Download PDF persona cards to align conversations and value messaging with key stakeholders.
                    </p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {BUYER_PERSONA_PDFS.map(({ label, filename, icon: Icon, jobToBeDone }, i) => (
                    <li
                      key={filename}
                      className="animate-in slide-in-from-left-4 duration-300"
                      style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
                    >
                      <a
                        href={`/buyer-personas/${encodeURIComponent(filename)}`}
                        download={filename}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg border p-3 text-sm text-foreground transition-colors hover:border-primary/50 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5 self-start" aria-hidden />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium block">{label}</span>
                          <span className="text-xs text-muted-foreground block mt-0.5">{jobToBeDone}</span>
                        </div>
                        <Download className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {markAsSeenOnClose && (
          <div className="shrink-0 px-6 py-4 border-t flex justify-end">
            <Button
              onClick={() => handleOpenChange(false)}
              className="gap-2"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
