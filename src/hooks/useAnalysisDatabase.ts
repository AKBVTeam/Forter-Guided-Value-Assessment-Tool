import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalculatorData } from "@/pages/Index";
import { toast } from "sonner";

export interface SavedAnalysisDB {
  id: string;
  user_id: string | null;
  name: string;
  author_name: string | null;
  customer_name: string | null;
  data: CalculatorData;
  customer_logo_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export function useAnalysisDatabase() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyses = useCallback(async (): Promise<SavedAnalysisDB[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // If not logged in, return empty array (localStorage fallback handled elsewhere)
        return [];
      }

      const { data, error: fetchError } = await supabase
        .from("saved_analyses")
        .select("*")
        .order("updated_at", { ascending: false });

      if (fetchError) throw fetchError;
      
      return (data || []) as SavedAnalysisDB[];
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch analyses";
      setError(message);
      console.error("Error fetching analyses:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAnalysis = useCallback(async (
    analysis: {
      id?: string;
      name: string;
      authorName: string;
      data: CalculatorData;
      customerLogoUrl: string;
      isPublic?: boolean;
    }
  ): Promise<SavedAnalysisDB | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please sign in to save analyses to the cloud");
        return null;
      }

      // Serialize data to JSON-compatible format
      const jsonData = JSON.parse(JSON.stringify(analysis.data));

      if (analysis.id) {
        // Update existing
        const { data, error: updateError } = await supabase
          .from("saved_analyses")
          .update({
            name: analysis.name,
            author_name: analysis.authorName,
            customer_name: analysis.data.customerName || null,
            data: jsonData,
            customer_logo_url: analysis.customerLogoUrl || null,
            is_public: analysis.isPublic || false,
          })
          .eq("id", analysis.id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return data as SavedAnalysisDB;
      } else {
        // Create new
        const { data, error: insertError } = await supabase
          .from("saved_analyses")
          .insert({
            user_id: user.id,
            name: analysis.name,
            author_name: analysis.authorName,
            customer_name: analysis.data.customerName || null,
            data: jsonData,
            customer_logo_url: analysis.customerLogoUrl || null,
            is_public: analysis.isPublic || false,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return data as SavedAnalysisDB;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save analysis";
      setError(message);
      console.error("Error saving analysis:", err);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAnalysis = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please sign in to delete analyses");
        return false;
      }

      const { error: deleteError } = await supabase
        .from("saved_analyses")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;
      
      toast.success("Analysis deleted");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete analysis";
      setError(message);
      console.error("Error deleting analysis:", err);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const togglePublic = useCallback(async (id: string, isPublic: boolean): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please sign in to share analyses");
        return false;
      }

      const { error: updateError } = await supabase
        .from("saved_analyses")
        .update({ is_public: isPublic })
        .eq("id", id)
        .eq("user_id", user.id);

      if (updateError) throw updateError;
      
      toast.success(isPublic ? "Analysis is now public" : "Analysis is now private");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update sharing";
      setError(message);
      console.error("Error toggling public:", err);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchAnalyses,
    saveAnalysis,
    deleteAnalysis,
    togglePublic,
  };
}
