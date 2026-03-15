import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalculatorData } from "@/pages/Index";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatbotInterfaceProps {
  onComplete: (data: CalculatorData) => void;
  onBulkUpdate?: (data: Partial<CalculatorData>) => void;
  initialData?: CalculatorData;
}

export const ChatbotInterface = ({ onComplete, onBulkUpdate, initialData }: ChatbotInterfaceProps) => {
  const hasInitialData = initialData && Object.keys(initialData).length > 1; // More than just forterKPIs
  const initialDataRef = useRef(initialData);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: hasInitialData 
        ? "I can see you've already entered some data. Would you like to continue editing your inputs, or start fresh? Just let me know what you'd like to change!"
        : "Hello! I'll help you calculate the potential GMV uplift with the fraud management solution. Let's start with your AMER region data. What is your annual GMV attempts in USD (the total value of all transaction attempts)?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [collectedData, setCollectedData] = useState<CalculatorData>(() => initialData || {});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Only sync from initialData on mount or when it's a completely different dataset (e.g., loading saved analysis)
  useEffect(() => {
    // Skip the initial render
    if (initialDataRef.current === initialData) return;
    
    // Only update if initialData changed significantly (not just from our own updates)
    if (initialData && Object.keys(initialData).length > 1) {
      const currentKeys = Object.keys(collectedData).length;
      const newKeys = Object.keys(initialData).length;
      // Only sync if this looks like a load operation (significant change in data)
      if (newKeys > currentKeys + 5) {
        setCollectedData(initialData);
        initialDataRef.current = initialData;
      }
    }
  }, [initialData]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-focus input after messages update and loading completes
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, messages]);

  const sanitizeAssistantText = (msg: string) => {
    return msg
      .replace(/\bannual\s+gross\s+revenue\b/gi, "annual GMV attempts")
      .replace(/\bgross\s+revenue\b/gi, "Annual GMV Attempts")
      .replace(/\brevenue\b/gi, "GMV");
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("fraud-calculator-chat", {
        body: {
          messages: [...messages, { role: "user", content: userMessage }],
          collectedData,
        },
      });

      if (error) throw error;

      // Parse response if it's a string
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch {
          parsedData = { message: data, updatedData: collectedData, isComplete: false };
        }
      }

      const sanitizedMsg = sanitizeAssistantText(parsedData.message);
      setMessages((prev) => [...prev, { role: "assistant", content: sanitizedMsg }]);

      if (parsedData.updatedData) {
        setCollectedData(parsedData.updatedData);
        // Notify parent of bulk update
        if (onBulkUpdate) {
          onBulkUpdate(parsedData.updatedData);
        }
      }

      if (parsedData.isComplete) {
        setTimeout(() => {
          onComplete(parsedData.updatedData);
          toast.success("Assessment complete!");
        }, 1000);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to send message. Please try again.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm sorry, I encountered an error. Could you please try again?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="max-w-4xl mx-auto p-6 h-[calc(100vh-200px)] flex flex-col">
      <h2 className="text-2xl font-bold mb-4">AI-Guided Assessment</h2>

      <ScrollArea className="flex-1 pr-4 mb-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-4">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your response..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
};
