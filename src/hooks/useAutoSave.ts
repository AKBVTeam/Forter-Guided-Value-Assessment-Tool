import { useEffect, useRef, useState, useCallback } from "react";
import { CalculatorData } from "@/pages/Index";
import { SavedAnalysis } from "@/components/calculator/WelcomeDialog";
import { useAnalysisDatabase } from "@/hooks/useAnalysisDatabase";
import { useAuth } from "@/hooks/useAuth";

interface UseAutoSaveOptions {
  data: CalculatorData;
  customerLogoUrl: string;
  debounceMs?: number;
  enabled?: boolean;
  onSaveComplete?: (savedAt: Date) => void;
}

interface AutoSaveState {
  status: "idle" | "saving" | "saved" | "error";
  lastSavedAt: Date | null;
  saveLocation: "local" | "cloud" | null;
}

export function useAutoSave({ 
  data, 
  customerLogoUrl, 
  debounceMs = 1500,
  enabled = true,
  onSaveComplete,
}: UseAutoSaveOptions) {
  const [state, setState] = useState<AutoSaveState>({
    status: "idle",
    lastSavedAt: null,
    saveLocation: null,
  });
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>("");
  const { saveAnalysis } = useAnalysisDatabase();
  const { isAuthenticated } = useAuth();

  const saveToLocalStorage = useCallback(() => {
    const analysisId = (data as any)._analysisId;
    const analysisName = (data as any)._analysisName;
    
    if (!analysisId) {
      return;
    }

    try {
      const existingRaw = localStorage.getItem("forter_saved_analyses");
      let existing: SavedAnalysis[] = [];
      if (existingRaw) {
        try {
          existing = JSON.parse(existingRaw);
        } catch (e) {
          console.error("Failed to parse saved analyses", e);
        }
      }

      const analysisIndex = existing.findIndex(a => a.id === analysisId);
      
      // Ensure _pathwayMode and _lastUpdatedAt are preserved in saved data
      const now = new Date();
      const dataToSave = {
        ...data,
        _pathwayMode: (data as any)._pathwayMode || 'manual',
        _lastUpdatedAt: now.toISOString(),
      };
      
      console.log('[useAutoSave] Saving with _pathwayMode:', (dataToSave as any)._pathwayMode);
      
      if (analysisIndex !== -1) {
        existing[analysisIndex] = {
          ...existing[analysisIndex],
          data: dataToSave,
          customerLogoUrl,
          savedAt: new Date(),
        };
      } else {
        existing.push({
          id: analysisId,
          name: analysisName || data.customerName || "Untitled Analysis",
          authorName: (data as any)._authorName || "",
          data: dataToSave,
          customerLogoUrl,
          savedAt: new Date(),
        });
      }

      localStorage.setItem("forter_saved_analyses", JSON.stringify(existing));
      lastSavedDataRef.current = JSON.stringify(data);
      return true;
    } catch (error) {
      console.error("Local auto-save failed:", error);
      return false;
    }
  }, [data, customerLogoUrl]);

  const saveToCloud = useCallback(async () => {
    const analysisId = (data as any)._analysisId;
    const analysisName = (data as any)._analysisName;
    const authorName = (data as any)._authorName;
    
    if (!analysisId) {
      return false;
    }

    try {
      // Ensure _pathwayMode and _lastUpdatedAt are preserved in saved data
      const now = new Date();
      const dataToSave = {
        ...data,
        _pathwayMode: (data as any)._pathwayMode || 'manual',
        _lastUpdatedAt: now.toISOString(),
      };
      
      console.log('[useAutoSave] Cloud saving with _pathwayMode:', (dataToSave as any)._pathwayMode);
      
      const result = await saveAnalysis({
        id: analysisId,
        name: analysisName || data.customerName || "Untitled Analysis",
        authorName: authorName || "",
        data: dataToSave,
        customerLogoUrl,
      });
      
      if (result) {
        lastSavedDataRef.current = JSON.stringify(data);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Cloud auto-save failed:", error);
      return false;
    }
  }, [data, customerLogoUrl, saveAnalysis]);

  const performSave = useCallback(async () => {
    setState(prev => ({ ...prev, status: "saving" }));

    let success = false;
    let location: "local" | "cloud" = "local";

    if (isAuthenticated) {
      // Try cloud save first
      success = await saveToCloud();
      if (success) {
        location = "cloud";
      } else {
        // Fall back to local
        success = saveToLocalStorage() ?? false;
        location = "local";
      }
    } else {
      // Not authenticated, save locally
      success = saveToLocalStorage() ?? false;
      location = "local";
    }

    if (success) {
      const savedAt = new Date();
      setState({
        status: "saved",
        lastSavedAt: savedAt,
        saveLocation: location,
      });
      // Update ref to include _lastUpdatedAt so the next render (after parent sets state)
      // sees data === ref and does not schedule another save.
      lastSavedDataRef.current = JSON.stringify({
        ...data,
        _lastUpdatedAt: savedAt.toISOString(),
      });
      onSaveComplete?.(savedAt);

      setTimeout(() => {
        setState(prev => prev.status === "saved" ? { ...prev, status: "idle" } : prev);
      }, 2000);
    } else {
      setState(prev => ({ ...prev, status: "error" }));
    }
  }, [isAuthenticated, saveToCloud, saveToLocalStorage]);

  useEffect(() => {
    if (!enabled) return;
    
    const analysisId = (data as any)._analysisId;
    if (!analysisId) return;

    const currentDataString = JSON.stringify(data);
    if (currentDataString === lastSavedDataRef.current) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, enabled, debounceMs, performSave]);

  // Also save when logo changes
  useEffect(() => {
    if (!enabled) return;
    const analysisId = (data as any)._analysisId;
    if (!analysisId) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [customerLogoUrl]);

  return state;
}
