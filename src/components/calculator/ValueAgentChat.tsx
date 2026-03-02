import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalculatorData } from "@/pages/Index";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2, MessageCircle, X, Sparkles, HelpCircle, Calculator, Lightbulb, ArrowRight, User, Settings, BarChart3, FileText, PanelLeftClose, PanelLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  suggestions?: Suggestion[];
}

interface Suggestion {
  type: "action" | "info";
  text: string;
  action?: string;
}

interface ValueAgentChatProps {
  calculatorData: CalculatorData;
  selectedChallenges: { [key: string]: boolean };
  onNavigate?: (tab: string) => void;
  currentPage?: 'landing' | 'form' | 'results';
  onDataChange?: (data: Partial<CalculatorData>) => void;
  onChallengeChange?: (challenges: { [key: string]: boolean }) => void;
  // Props for split-pane mode
  isSplitPane?: boolean;
  onToggleSplitPane?: () => void;
  // Whether tabs requiring challenges are unlocked
  hasSelectedChallenges?: boolean;
}

const createInitialMessage = (currentPage: 'landing' | 'form' | 'results'): Message => {
  if (currentPage === 'landing') {
    return {
      role: "assistant",
      content: "Welcome! Choose Guided Pathway (recommended) for step-by-step discovery, or Custom Pathway for direct value entry.",
      suggestions: [
        { type: "action", text: "Start Guided", action: "navigate:guided" },
      ],
    };
  }
  return {
    role: "assistant",
    content: "Hi! I can help you navigate, explain calculations, or answer questions about the value assessment.",
    suggestions: [
      { type: "action", text: "What's next?", action: "ask:next_steps" },
    ],
  };
};

const FAQ_PROMPTS = [
  { icon: HelpCircle, text: "What should I do next?", prompt: "Based on the current progress, what should be done next to complete this value assessment?" },
  { icon: Calculator, text: "Explain the results", prompt: "Can you explain the value calculations and what's driving the results?" },
  { icon: Lightbulb, text: "Tips to maximize value", prompt: "What tips can you share to help identify the maximum value for this prospect?" },
  { icon: Settings, text: "Which inputs are missing?", prompt: "Which required input fields are still missing or empty in this assessment?" },
];

const QUICK_ACTIONS = [
  { icon: User, text: "Complete Profile", action: "navigate:profile", description: "Set customer details", requiresChallenges: false },
  { icon: FileText, text: "Select Use Cases", action: "navigate:challenges", description: "Choose relevant challenges", requiresChallenges: false },
  { icon: Settings, text: "Enter Inputs", action: "navigate:inputs", description: "Add transaction data", requiresChallenges: true },
  { icon: BarChart3, text: "View Summary", action: "navigate:summary", description: "See calculated value", requiresChallenges: true },
];

const VALUE_AGENT_UNAVAILABLE_KEY = "value_agent_unavailable";

export const ValueAgentChat = ({ 
  calculatorData, 
  selectedChallenges, 
  onNavigate, 
  currentPage = 'form',
  onDataChange,
  onChallengeChange,
  isSplitPane = false,
  onToggleSplitPane,
  hasSelectedChallenges = false,
}: ValueAgentChatProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Helper to strip markdown formatting (** for bold)
  const stripMarkdown = (text: string): string => {
    return text.replace(/\*\*/g, '');
  };

  const analysisId = (calculatorData as any)?._analysisId as string | undefined;
  const storageKey = useMemo(
    () => (analysisId ? `forter_chat_history_${analysisId}` : null),
    [analysisId]
  );

  const [messages, setMessages] = useState<Message[]>(() => [createInitialMessage(currentPage)]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(() => typeof sessionStorage !== "undefined" && sessionStorage.getItem(VALUE_AGENT_UNAVAILABLE_KEY) === "1");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTryAgain = useCallback(() => {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(VALUE_AGENT_UNAVAILABLE_KEY);
    setIsUnavailable(false);
  }, []);

  // Load persisted chat history (per analysis)
  useEffect(() => {
    if (!storageKey) return;

    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      setMessages([createInitialMessage(currentPage)]);
      setShowQuickActions(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages(parsed);
        setShowQuickActions(parsed.filter((m: Message) => m.role === "user").length === 0);
      }
    } catch {
      // ignore
    }
    // Only reload when analysis changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist chat history (per analysis)
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [storageKey, messages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Auto-focus input when chat opens
  useEffect(() => {
    if ((isOpen || isSplitPane) && !isLoading && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isLoading, isSplitPane]);

  // Hide quick actions after first user message
  useEffect(() => {
    if (messages.filter(m => m.role === "user").length > 0) {
      setShowQuickActions(false);
    }
  }, [messages]);

  const handleAction = useCallback((action: string) => {
    if (action.startsWith("navigate:")) {
      const tab = action.replace("navigate:", "");
      // Map common variations to valid tab names
      const tabMapping: Record<string, string> = {
        'profile': 'profile',
        'challenges': 'challenges', 
        'use cases': 'challenges',
        'usecases': 'challenges',
        'inputs': 'inputs',
        'customer inputs': 'inputs',
        'forter': 'forter',
        'forter kpis': 'forter',
        'kpis': 'forter',
        'summary': 'summary',
        'value summary': 'summary',
        'roi': 'roi',
        'guided': 'profile', // Fallback guided to profile
      };
      const validTab = tabMapping[tab.toLowerCase()] || tab;
      const validTabs = ['profile', 'challenges', 'inputs', 'forter', 'summary', 'roi'];
      if (validTabs.includes(validTab)) {
        onNavigate?.(validTab);
        toast.success(`Navigating to ${validTab.charAt(0).toUpperCase() + validTab.slice(1)} tab`);
      } else {
        toast.error(`Unknown tab: ${tab}. Try profile, challenges, inputs, forter, summary, or roi.`);
      }
    } else if (action.startsWith("ask:")) {
      const prompt = action === "ask:next_steps" 
        ? "Based on my current progress, what should I do next?" 
        : action === "ask:pathway_difference"
        ? "What's the difference between Guided and Custom pathways?"
        : action.replace("ask:", "");
      sendMessage(prompt);
    }
  }, [onNavigate]);

  const handleClearChat = useCallback(() => {
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
    setMessages([createInitialMessage(currentPage)]);
    setShowQuickActions(true);
    setInput("");
    setShowClearConfirm(false);
    toast.success("Chat cleared for this analysis");
  }, [storageKey, currentPage]);

  const sendMessage = useCallback(async (messageText?: string) => {
    const userMessage = (messageText || input).trim();
    if (!userMessage || isLoading || isUnavailable) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const contextSummary = {
        customerName: calculatorData.customerName || "Not set",
        industry: calculatorData.industry || "Not set",
        hqLocation: calculatorData.hqLocation || "Not set",
        selectedChallengesCount: Object.values(selectedChallenges).filter(Boolean).length,
        hasGMVData: !!(calculatorData.amerAnnualGMV || calculatorData.emeaAnnualGMV || calculatorData.apacAnnualGMV),
        hasForterKPIs: !!calculatorData.forterKPIs,
        segmentationEnabled: calculatorData.segmentationEnabled,
        segmentsCount: calculatorData.segments?.length || 0,
        currentPage,
      };

      const { data, error } = await supabase.functions.invoke("fraud-calculator-chat", {
        body: {
          messages: [...messages.filter(m => m.role === "user" || m.role === "assistant").map(m => ({ role: m.role, content: m.content })), { role: "user", content: userMessage }],
          collectedData: calculatorData,
          contextSummary,
          isAssistantMode: true,
        },
      });

      if (error) {
        setIsUnavailable(true);
        if (typeof sessionStorage !== "undefined") sessionStorage.setItem(VALUE_AGENT_UNAVAILABLE_KEY, "1");
        toast.error("Value Agent is currently unavailable.");
        return;
      }

      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch {
          parsedData = { message: data };
        }
      }

      const rawMessage = parsedData.message || (typeof parsedData === 'string' ? parsedData : JSON.stringify(parsedData));
      // Strip markdown ** from response
      const assistantMessage = stripMarkdown(rawMessage);
      const suggestions = parsedData.suggestions || [];

      setMessages((prev) => [...prev, { 
        role: "assistant", 
        content: assistantMessage,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      }]);
    } catch (error) {
      console.error("Value Agent error:", error);
      setIsUnavailable(true);
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(VALUE_AGENT_UNAVAILABLE_KEY, "1");
      toast.error("Value Agent is currently unavailable.");
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, isUnavailable, messages, calculatorData, selectedChallenges, currentPage]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFAQClick = (prompt: string) => {
    sendMessage(prompt);
  };

  // Render the chat content (shared between modes)
  const renderChatContent = () => (
    <>
      {/* Messages with proper scrolling */}
      <ScrollArea className="flex-1 h-full overflow-y-auto" ref={scrollAreaRef} style={{ height: '100%' }}>
        <div className="p-3 space-y-3">
          {messages.map((message, index) => (
            <div key={index}>
              <div
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
              
              {/* Inline action suggestions */}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 ml-0">
                  {message.suggestions.map((suggestion, sIdx) => (
                    <Button
                      key={sIdx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction(suggestion.action || `ask:${suggestion.text}`)}
                      className="text-xs h-7 gap-1 bg-background hover:bg-primary/10 hover:border-primary/50"
                      disabled={isLoading || isUnavailable}
                    >
                      <ArrowRight className="h-3 w-3" />
                      {stripMarkdown(suggestion.text)}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick Actions - Show initially */}
      {showQuickActions && messages.length <= 1 && (
        <div className="px-3 pb-2 border-t pt-3">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Quick actions:</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action, index) => {
              const isLocked = action.requiresChallenges && !hasSelectedChallenges;
              return (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => !isLocked && handleAction(action.action)}
                  className={`h-auto py-2 px-2 flex flex-col items-start gap-0.5 ${isLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-primary/10 hover:border-primary/50"}`}
                  disabled={isLoading || isUnavailable || isLocked}
                  title={isLocked ? "Select at least one use case to unlock" : undefined}
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <action.icon className="h-3.5 w-3.5" />
                    {action.text}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {isLocked ? "🔒 Select use cases first" : action.description}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* FAQ Prompts - show after quick actions are hidden */}
      {!showQuickActions && messages.length > 1 && messages.length < 5 && (
        <div className="px-3 pb-2">
          <p className="text-xs text-muted-foreground mb-2">Quick questions:</p>
          <div className="flex flex-wrap gap-1">
            {FAQ_PROMPTS.slice(0, 2).map((faq, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleFAQClick(faq.prompt)}
                className="text-xs h-7 gap-1"
                disabled={isLoading || isUnavailable}
              >
                <faq.icon className="h-3 w-3" />
                {faq.text}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask a question..."
          disabled={isLoading || isUnavailable}
          className="flex-1 text-sm"
        />
        <Button onClick={() => sendMessage()} disabled={isLoading || isUnavailable || !input.trim()} size="icon" className="h-9 w-9">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </>
  );

  // Split pane mode - rendered as a full side panel with fixed height
  if (isSplitPane) {
    return (
      <div className="h-[100dvh] flex flex-col bg-background border-l overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b bg-primary/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Value Agent</h3>
              <p className="text-xs text-muted-foreground">Ask questions</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {storageKey && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowClearConfirm(true)}
                className="h-8 w-8 shrink-0"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {onToggleSplitPane && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleSplitPane}
                className="h-8 w-8 shrink-0"
                title="Close chat panel"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <div className={cn("flex-1 flex flex-col min-h-0 overflow-hidden", isUnavailable && "pointer-events-none opacity-60")}>
            {renderChatContent()}
          </div>
          {isUnavailable && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/90 rounded-b">
              <p className="text-sm font-medium text-muted-foreground">Currently unavailable</p>
            </div>
          )}
        </div>

        <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the chat history for this analysis.
                <br />
                <strong className="text-destructive">You won't be able to recover it.</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearChat}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Clear chat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Floating button + popup mode (default)
  return (
    <>
      {/* Floating Buttons */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {/* Open side panel button */}
        {onToggleSplitPane && (
          <Button
            onClick={onToggleSplitPane}
            className="h-10 w-10 rounded-full shadow-lg bg-muted text-muted-foreground hover:bg-muted/80"
            size="icon"
            title="Open chat panel"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        )}
        
        {/* Main chat toggle button */}
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "h-14 w-14 rounded-full shadow-lg transition-all duration-300",
            isOpen ? "bg-muted text-muted-foreground hover:bg-muted/80" : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          size="icon"
        >
          {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        </Button>
      </div>

      {/* Chat Popup */}
      <Card
        className={cn(
          "fixed bottom-24 right-6 z-40 w-[380px] max-h-[480px] flex flex-col shadow-2xl transition-all duration-300 origin-bottom-right",
          isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="p-3 border-b bg-primary/5 rounded-t-lg flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Value Agent</h3>
              <p className="text-xs text-muted-foreground">Ask questions</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {storageKey && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowClearConfirm(true)}
                className="h-8 w-8"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {onToggleSplitPane && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsOpen(false);
                  onToggleSplitPane();
                }}
                className="h-8 w-8"
                title="Open as side panel"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex flex-col flex-1 overflow-hidden relative" style={{ maxHeight: 'calc(100vh - 300px)', minHeight: '200px' }}>
          <div className={cn("flex flex-col flex-1 overflow-hidden", isUnavailable && "pointer-events-none opacity-60")}>
            {renderChatContent()}
          </div>
          {isUnavailable && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted/90 rounded-b-lg p-4">
              <p className="text-sm font-medium text-muted-foreground text-center">Currently unavailable</p>
              <Button variant="secondary" size="sm" onClick={handleTryAgain}>
                Try again
              </Button>
            </div>
          )}
        </div>

        <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the chat history for this analysis.
                <br />
                <strong className="text-destructive">You won't be able to recover it.</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearChat}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Clear chat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </>
  );
};
