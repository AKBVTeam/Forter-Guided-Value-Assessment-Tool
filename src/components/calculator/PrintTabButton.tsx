import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface PrintTabButtonProps {
  currentTabName: string;
  analysisName?: string;
}

// Format date as MMDDYY
function formatDateMMDDYY(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${mm}${dd}${yy}`;
}

export function PrintTabButton({ 
  currentTabName, 
  analysisName = 'Value_Assessment'
}: PrintTabButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const captureCurrentTab = async () => {
    setIsGenerating(true);
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      const tabPanel = document.querySelector('[role="tabpanel"][data-state="active"]') as HTMLElement;
      
      if (!tabPanel) {
        toast.error('Could not find tab content to capture');
        return;
      }
      
      // Capture the visible tab content
      const canvas = await html2canvas(tabPanel, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      // Create PDF in landscape
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const headerHeight = 8;

      // Add analysis name at top of PDF
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Analysis: ${analysisName}`, margin, margin + 4);

      // Scale image to fit page below the header
      const contentTop = margin + headerHeight;
      const availableHeight = pageHeight - (margin * 2) - headerHeight;
      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let finalWidth = imgWidth;
      let finalHeight = imgHeight;
      
      if (imgHeight > availableHeight) {
        finalHeight = availableHeight;
        finalWidth = (canvas.width * finalHeight) / canvas.height;
      }
      
      pdf.addImage(imgData, 'PNG', margin, contentTop, finalWidth, finalHeight);
      
      // Save with formatted filename
      const dateStr = formatDateMMDDYY();
      const sanitizedName = analysisName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') || 'Value_Assessment';
      const tabSuffix = `_${currentTabName.replace(/\s+/g, '_')}`;
      const filename = `${sanitizedName}${tabSuffix} (${dateStr}).pdf`;
      
      pdf.save(filename);
      toast.success(`PDF saved: ${filename}`);
      
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={captureCurrentTab}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>Screenshot this tab</p>
      </TooltipContent>
    </Tooltip>
  );
}
