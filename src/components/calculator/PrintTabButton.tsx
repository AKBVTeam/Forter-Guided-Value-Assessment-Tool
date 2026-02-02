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

      const contentTop = margin + headerHeight;
      const availableWidth = pageWidth - (margin * 2);
      const availableHeight = pageHeight - (margin * 2) - headerHeight;

      // Fill page width: image height when drawn at full width (in mm)
      const imgHeightAtFullWidth = (canvas.height * availableWidth) / canvas.width;
      const numPages = Math.max(1, Math.ceil(imgHeightAtFullWidth / availableHeight));

      // Scale factor: canvas pixels per mm when drawn at availableWidth
      const canvasPxPerMm = canvas.width / availableWidth;
      const sliceHeightPx = availableHeight * canvasPxPerMm;

      for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
        if (pageIndex > 0) {
          pdf.addPage('a4', 'l');
        }

        // Add analysis name at top of each page
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Analysis: ${analysisName}${numPages > 1 ? ` (page ${pageIndex + 1}/${numPages})` : ''}`, margin, margin + 4);

        const sourceY = pageIndex * sliceHeightPx;
        const sourceH = Math.min(sliceHeightPx, canvas.height - sourceY);

        if (sourceH <= 0) continue;

        // Create a slice canvas for this page
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.ceil(sourceH);
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) continue;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceH, 0, 0, canvas.width, sourceH);
        const sliceData = sliceCanvas.toDataURL('image/png');

        // Draw slice to fill page width; height may be less on last page
        const drawHeightMm = (sourceH / canvasPxPerMm);
        pdf.addImage(sliceData, 'PNG', margin, contentTop, availableWidth, drawHeightMm);
      }
      
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
