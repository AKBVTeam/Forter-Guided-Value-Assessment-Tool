/**
 * CSV Import utility for parsing customer input data back into the calculator
 */

import { CalculatorData } from "@/pages/Index";
import { getRequiredInputFields } from "./csvExport";

interface ParsedCSVRow {
  section: string;
  description: string;
  type: string;
  exampleValue: string;
  yourValue: string;
  additionalNotes: string;
}

interface ImportResult {
  success: boolean;
  updatedFields: string[];
  warnings: string[];
  errors: string[];
}

/**
 * Parse CSV content into structured rows
 */
function parseCSVContent(content: string): ParsedCSVRow[] {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/a894244a-83d8-49b5-946b-6b83a02a97f5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csvImport.ts:27',message:'parseCSVContent entry',data:{contentLength:content.length,firstLines:content.split('\n').slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
  // #endregion
  const lines = content.split('\n');
  const rows: ParsedCSVRow[] = [];
  
  let inDataSection = false;
  
  for (const line of lines) {
    // Skip empty lines and header comments
    if (!line.trim() || line.startsWith('#')) {
      continue;
    }
    
    // Skip the header row - Updated to handle both old format (without Segment) and new format (with Segment)
    // #region agent log
    const headerCheck = line.includes('Section,Description,Type');
    const headerHasSegment = line.includes('Segment,Section');
    fetch('http://127.0.0.1:7242/ingest/a894244a-83d8-49b5-946b-6b83a02a97f5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csvImport.ts:40',message:'Header detection check',data:{line:line.substring(0,100),headerCheck,headerHasSegment,inDataSection},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (line.includes('Section,Description,Type') || line.includes('Segment,Section,Description,Type')) {
      inDataSection = true;
      continue;
    }
    
    if (!inDataSection) continue;
    
    // Parse CSV row (handle quoted values with commas)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a894244a-83d8-49b5-946b-6b83a02a97f5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csvImport.ts:55',message:'Raw CSV line before parsing',data:{rawLine:line,lineLength:line.length,hasQuotes:line.includes('"'),hasCommas:line.split(',').length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const values = parseCSVRow(line);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a894244a-83d8-49b5-946b-6b83a02a97f5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csvImport.ts:50',message:'Parsed row values',data:{valuesLength:values.length,values:values.slice(0,7),valuesIndices:{'0':values[0],'1':values[1],'2':values[2],'3':values[3],'4':values[4],'5':values[5],'6':values[6]},rawLinePreview:line.substring(0,150)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,C'})}).catch(()=>{});
    // #endregion
    
    // Check if CSV has Segment column (7 columns) or old format (6 columns)
    const hasSegmentColumn = values.length >= 7;
    
    if (values.length >= (hasSegmentColumn ? 7 : 6)) {
      const parsedRow = hasSegmentColumn ? {
        // New format with Segment column: Segment, Section, Description, Type, Example Value, Your Value, Additional Notes
        section: values[1]?.replace(/^"|"$/g, '') || '',      // Index 1 = Section
        description: values[2]?.replace(/^"|"$/g, '') || '',  // Index 2 = Description
        type: values[3]?.replace(/^"|"$/g, '') || '',          // Index 3 = Type
        exampleValue: values[4]?.replace(/^"|"$/g, '') || '',  // Index 4 = Example Value
        yourValue: values[5]?.replace(/^"|"$/g, '') || '',    // Index 5 = Your Value (FIXED!)
        additionalNotes: values[6]?.replace(/^"|"$/g, '') || '', // Index 6 = Additional Notes
      } : {
        // Old format without Segment: Section, Description, Type, Example Value, Your Value, Additional Notes
        section: values[0]?.replace(/^"|"$/g, '') || '',
        description: values[1]?.replace(/^"|"$/g, '') || '',
        type: values[2]?.replace(/^"|"$/g, '') || '',
        exampleValue: values[3]?.replace(/^"|"$/g, '') || '',
        yourValue: values[4]?.replace(/^"|"$/g, '') || '',
        additionalNotes: values[5]?.replace(/^"|"$/g, '') || '',
      };
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a894244a-83d8-49b5-946b-6b83a02a97f5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csvImport.ts:66',message:'Parsed row object',data:{hasSegmentColumn,parsedRow,expectedYourValueColumn:hasSegmentColumn?(values.length>=6?values[5]:'N/A'):(values.length>=5?values[4]:'N/A'),actualYourValueRead:parsedRow.yourValue,additionalNotesRead:parsedRow.additionalNotes},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      rows.push(parsedRow);
    }
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/a894244a-83d8-49b5-946b-6b83a02a97f5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csvImport.ts:63',message:'parseCSVContent exit',data:{rowsCount:rows.length,rowsWithValues:rows.filter(r=>r.yourValue.trim()).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
  // #endregion
  return rows;
}

/**
 * Parse a single CSV row handling quoted values
 */
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Map a description label back to the field name
 */
function findFieldByDescription(
  description: string,
  selectedChallenges: { [key: string]: boolean },
  currencySymbol: string
): string | null {
  const fields = getRequiredInputFields(selectedChallenges, currencySymbol);
  
  // Find by exact label match
  const field = fields.find(f => f.label === description);
  if (field) return field.field;
  
  // Try matching without currency symbol variations
  const normalizedDesc = description.replace(/\([^)]*\)/g, '').trim();
  const matchingField = fields.find(f => {
    const normalizedLabel = f.label.replace(/\([^)]*\)/g, '').trim();
    return normalizedLabel === normalizedDesc;
  });
  
  return matchingField?.field || null;
}

/**
 * Parse a value string into a number
 */
function parseValueToNumber(value: string): number | null {
  if (!value || value.trim() === '') return null;
  
  // Remove currency symbols, commas, and whitespace
  const cleaned = value.replace(/[$€£¥,\s]/g, '').trim();
  
  if (cleaned === '') return null;
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Import CSV data into calculator form data
 */
export function importCSVToFormData(
  csvContent: string,
  currentFormData: CalculatorData,
  selectedChallenges: { [key: string]: boolean },
  currencySymbol: string = '$'
): ImportResult {
  const result: ImportResult = {
    success: false,
    updatedFields: [],
    warnings: [],
    errors: [],
  };
  
  try {
    const rows = parseCSVContent(csvContent);
    
    if (rows.length === 0) {
      result.errors.push('No data rows found in the CSV file');
      return result;
    }
    
    const updates: Partial<CalculatorData> = {};
    
    for (const row of rows) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a894244a-83d8-49b5-946b-6b83a02a97f5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csvImport.ts:160',message:'Processing row',data:{description:row.description,yourValue:row.yourValue,additionalNotes:row.additionalNotes,hasYourValue:!!row.yourValue&&row.yourValue.trim()!==''},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Skip rows without values
      if (!row.yourValue || row.yourValue.trim() === '') {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a894244a-83d8-49b5-946b-6b83a02a97f5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csvImport.ts:162',message:'Skipping row - no yourValue',data:{description:row.description,yourValue:row.yourValue,additionalNotes:row.additionalNotes},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        continue;
      }
      
      const fieldName = findFieldByDescription(row.description, selectedChallenges, currencySymbol);
      
      if (!fieldName) {
        result.warnings.push(`Could not match field: "${row.description}"`);
        continue;
      }
      
      const parsedValue = parseValueToNumber(row.yourValue);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a894244a-83d8-49b5-946b-6b83a02a97f5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'csvImport.ts:173',message:'Parsing value',data:{description:row.description,yourValue:row.yourValue,parsedValue,fieldName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      if (parsedValue === null) {
        result.warnings.push(`Invalid value for "${row.description}": "${row.yourValue}"`);
        continue;
      }
      
      // Add to updates
      (updates as any)[fieldName] = parsedValue;
      result.updatedFields.push(row.description);
    }
    
    if (result.updatedFields.length > 0) {
      result.success = true;
    }
    
    // Return the updates object for the caller to merge
    (result as any).updates = updates;
    
  } catch (error) {
    result.errors.push(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return result;
}

/**
 * Get the updates from an import result
 */
export function getImportUpdates(result: ImportResult): Partial<CalculatorData> {
  return (result as any).updates || {};
}

/**
 * Check if user has downloaded template (localStorage based persistence)
 */
export function hasDownloadedTemplate(): boolean {
  return localStorage.getItem('forter_csv_template_downloaded') === 'true';
}

/**
 * Mark that user has downloaded template
 */
export function markTemplateDownloaded(): void {
  localStorage.setItem('forter_csv_template_downloaded', 'true');
}
