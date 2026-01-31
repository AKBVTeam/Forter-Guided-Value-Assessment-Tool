import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderOpen, Trash2, Cloud, HardDrive, Globe, Lock, Loader2 } from "lucide-react";
import { CalculatorData } from "@/pages/Index";
import { SavedAnalysis } from "./WelcomeDialog";
import { useAnalysisDatabase, SavedAnalysisDB } from "@/hooks/useAnalysisDatabase";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface OpenAnalysisButtonProps {
  onLoadAnalysis: (data: CalculatorData, logoUrl: string) => void;
}

export const OpenAnalysisButton = ({ onLoadAnalysis }: OpenAnalysisButtonProps) => {
  const [open, setOpen] = useState(false);
  const [localAnalyses, setLocalAnalyses] = useState<SavedAnalysis[]>([]);
  const [cloudAnalyses, setCloudAnalyses] = useState<SavedAnalysisDB[]>([]);
  const { fetchAnalyses, deleteAnalysis, togglePublic, loading } = useAnalysisDatabase();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (open) {
      // Load local storage analyses
      const saved = localStorage.getItem("forter_saved_analyses");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const mapped = parsed.map((s: SavedAnalysis) => ({
            ...s,
            savedAt: new Date(s.savedAt),
          }));
          // Sort by savedAt descending (newest first)
          mapped.sort((a: SavedAnalysis, b: SavedAnalysis) => b.savedAt.getTime() - a.savedAt.getTime());
          setLocalAnalyses(mapped);
        } catch (e) {
          console.error("Failed to parse saved analyses", e);
        }
      }

      // Load cloud analyses if authenticated
      if (isAuthenticated) {
        fetchAnalyses().then(setCloudAnalyses);
      }
    }
  }, [open, isAuthenticated, fetchAnalyses]);

  const handleDeleteLocal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = localAnalyses.filter((s) => s.id !== id);
    setLocalAnalyses(updated);
    localStorage.setItem("forter_saved_analyses", JSON.stringify(updated));
  };

  const handleDeleteCloud = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await deleteAnalysis(id);
    if (success) {
      setCloudAnalyses(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleTogglePublic = async (id: string, currentState: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await togglePublic(id, !currentState);
    if (success) {
      setCloudAnalyses(prev => prev.map(a => 
        a.id === id ? { ...a, is_public: !currentState } : a
      ));
    }
  };

  const handleLoadLocal = (analysis: SavedAnalysis) => {
    const savedAtIso = analysis.savedAt instanceof Date
      ? analysis.savedAt.toISOString()
      : new Date(analysis.savedAt).toISOString();
    onLoadAnalysis(
      { ...analysis.data, _lastUpdatedAt: savedAtIso } as CalculatorData,
      analysis.customerLogoUrl
    );
    setOpen(false);
  };

  const handleLoadCloud = (analysis: SavedAnalysisDB) => {
    onLoadAnalysis(
      { ...analysis.data, _lastUpdatedAt: analysis.updated_at } as CalculatorData,
      analysis.customer_logo_url || ""
    );
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FolderOpen className="w-4 h-4" />
          Open
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open Saved Analysis</DialogTitle>
          <DialogDescription>
            Select a previously saved analysis to continue working on it.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={isAuthenticated ? "cloud" : "local"} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cloud" className="gap-2" disabled={!isAuthenticated}>
              <Cloud className="w-4 h-4" />
              Cloud
              {!isAuthenticated && <span className="text-xs">(Sign in)</span>}
            </TabsTrigger>
            <TabsTrigger value="local" className="gap-2">
              <HardDrive className="w-4 h-4" />
              Local
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cloud" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : cloudAnalyses.length > 0 ? (
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-2 space-y-2">
                  {cloudAnalyses.map((analysis) => (
                    <div
                      key={analysis.id}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => handleLoadCloud(analysis)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{analysis.name}</span>
                          {analysis.is_public ? (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Globe className="w-3 h-3" />
                              Public
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Lock className="w-3 h-3" />
                              Private
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(analysis.updated_at).toLocaleString()}
                          {analysis.author_name && ` • by ${analysis.author_name}`}
                        </div>
                        {analysis.customer_name && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Customer: {analysis.customer_name}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => handleTogglePublic(analysis.id, analysis.is_public, e)}
                          title={analysis.is_public ? "Make private" : "Make public"}
                        >
                          {analysis.is_public ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Globe className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => handleDeleteCloud(analysis.id, e)}
                          title="Delete analysis"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Cloud className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No cloud analyses yet</p>
                <p className="text-sm">Analyses will sync across devices</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="local" className="mt-4">
            {localAnalyses.length > 0 ? (
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-2 space-y-2">
                  {localAnalyses.map((analysis) => (
                    <div
                      key={analysis.id}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => handleLoadLocal(analysis)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{analysis.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(analysis.savedAt).toLocaleString()}
                          {analysis.authorName && ` • by ${analysis.authorName}`}
                        </div>
                        {analysis.data.customerName && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Customer: {analysis.data.customerName}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                        onClick={(e) => handleDeleteLocal(analysis.id, e)}
                        title="Delete analysis"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No local analyses</p>
                <p className="text-sm">Local saves are stored in this browser only</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
