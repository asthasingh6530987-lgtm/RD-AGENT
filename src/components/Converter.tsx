import React, { useState } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as pdfjsLib from 'pdfjs-dist';
import { GlobalWorkerOptions, version } from 'pdfjs-dist';
import { Upload, FileText, FileDown, Loader2, AlertCircle, X, CheckCircle2, RefreshCw, Eye, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// Set worker source to CDN to avoid Vite bundling issues (fixes hashOriginal.toHex error)
GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;

export default function Converter() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [conversionType, setConversionType] = useState<'csv-to-pdf' | 'pdf-to-csv' | 'ai-pdf-extraction' | 'ai-account-extraction'>('csv-to-pdf');

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const extractDataWithAI = async (fileToParse: File) => {
    setProcessing(true);
    setError(null);
    setSuccess(null);
    try {
      const base64Data = await fileToBase64(fileToParse);

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `You are a highly accurate data extraction tool. I will provide you with a PDF document. Your job is to extract the main data table from the document.

CRITICAL INSTRUCTIONS:
- You MUST preserve the EXACT sequence and order of the rows as they appear in the original document from top to bottom.
- Output the extracted data STRICTLY in standard CSV format.
- Include a header row representing the columns found in the table.
- Do not include any markdown formatting, conversational text, or explanations. Only return the raw CSV text.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: "application/pdf",
              },
            },
            {
              text: prompt,
            },
          ],
        },
      });

      let csvText = response.text;
      if (!csvText) {
          throw new Error('No data extracted');
      }
      
      // Strip markdown code blocks if the model includes them
      csvText = csvText.replace(/```csv\n?/gi, '').replace(/```\n?/g, '').trim();

      // 3. Parse CSV
      const results = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
      });

      if (results.data.length === 0) {
          throw new Error('No data found in extracted CSV.');
      }

      setHeaders(Object.keys(results.data[0] as object));
      setParsedData(results.data);
      setSuccess('Data extracted successfully.');

    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error('Error extracting data:', errorMsg);
      setError('Error extracting data: ' + errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const extractAccountDetailsWithAI = async (fileToParse: File) => {
    setProcessing(true);
    setError(null);
    setSuccess(null);
    try {
      const base64Data = await fileToBase64(fileToParse);

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `You are a highly accurate data extraction tool. I will provide you with a PDF document. Your job is to extract ONLY the following three fields from the document for each record found:

1. Account No
2. Account Name
3. Denomination

CRITICAL INSTRUCTIONS:
- You MUST preserve the EXACT sequence and order of the records as they appear in the original document from top to bottom.
- Output the extracted data STRICTLY in standard CSV format.
- Include a header row: Account No,Account Name,Denomination.
- Do not include any markdown formatting, conversational text, or explanations. Only return the raw CSV text.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: "application/pdf",
              },
            },
            {
              text: prompt,
            },
          ],
        },
      });

      let csvText = response.text;
      if (!csvText) {
          throw new Error('No data extracted');
      }
      
      // Strip markdown code blocks if the model includes them
      csvText = csvText.replace(/```csv\n?/gi, '').replace(/```\n?/g, '').trim();

      // 3. Parse CSV
      const results = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
      });

      if (results.data.length === 0) {
          throw new Error('No data found in extracted CSV.');
      }

      setHeaders(Object.keys(results.data[0] as object));
      setParsedData(results.data);
      setSuccess('Account details extracted successfully.');

    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error('Error extracting data:', errorMsg);
      setError('Error extracting data: ' + errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    console.log('File selected:', selectedFile?.name, selectedFile?.type);
    if (selectedFile) {
      if (conversionType === 'csv-to-pdf' && selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Please select a valid CSV file.');
        setFile(null);
        setParsedData([]);
        setHeaders([]);
        e.target.value = '';
        return;
      }
      if (conversionType === 'pdf-to-csv' || conversionType === 'ai-pdf-extraction' || conversionType === 'ai-account-extraction') {
        if (selectedFile.type !== 'application/pdf' && !selectedFile.name.endsWith('.pdf')) {
          setError('Please select a valid PDF file.');
          setFile(null);
          setParsedData([]);
          setHeaders([]);
          e.target.value = '';
          return;
        }
      }
      setFile(selectedFile);
      setError(null);
      setSuccess(null);
    }
    e.target.value = '';
  };

  const handleConvert = () => {
    if (!file) return;
    if (conversionType === 'csv-to-pdf') {
      parseCSV(file);
    } else if (conversionType === 'pdf-to-csv') {
      parsePDF(file);
    } else if (conversionType === 'ai-pdf-extraction') {
      extractDataWithAI(file);
    } else if (conversionType === 'ai-account-extraction') {
      extractAccountDetailsWithAI(file);
    }
  };

  const parsePDF = async (fileToParse: File) => {
    setProcessing(true);
    console.log('Parsing PDF:', fileToParse.name);
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(fileToParse);
      const pdf = await pdfjsLib.getDocument(objectUrl).promise;
      console.log('PDF loaded, pages:', pdf.numPages);
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        const items = textContent.items as any[];
        
        // 1. Filter out empty items
        const validItems = items.filter(item => item.str.trim() !== '');
        
        // 2. Sort items by Y descending (top to bottom)
        validItems.sort((a, b) => b.transform[5] - a.transform[5]);

        // 3. Group items into rows using single-linkage clustering on Y
        const rows: any[][] = [];
        let currentRow: any[] = [];

        for (const item of validItems) {
            const y = item.transform[5];
            if (currentRow.length === 0) {
                currentRow.push(item);
            } else {
                const lastY = currentRow[currentRow.length - 1].transform[5];
                if (Math.abs(lastY - y) <= 5) { // 5 points tolerance
                    currentRow.push(item);
                } else {
                    rows.push(currentRow);
                    currentRow = [item];
                }
            }
        }
        if (currentRow.length > 0) {
            rows.push(currentRow);
        }

        // 4. For each row, group items into cells based on X distance
        const cellXCoords: number[] = [];
        const rowCells: { text: string, x: number }[][] = [];

        for (const row of rows) {
            // Sort items in row left to right
            row.sort((a, b) => a.transform[4] - b.transform[4]);

            const cells: { text: string, x: number }[] = [];
            let lastX: number | null = null;
            let lastWidth: number | null = null;

            for (const item of row) {
                const x = item.transform[4];
                const width = item.width;
                const str = item.str.trim();

                if (lastX === null) {
                    cells.push({ text: str, x: x });
                } else {
                    const distance = x - (lastX + lastWidth);
                    if (distance > 15) { // Threshold for new cell
                        cells.push({ text: str, x: x });
                    } else {
                        // Same cell, append with space
                        cells[cells.length - 1].text += ' ' + str;
                    }
                }
                lastX = x;
                lastWidth = width;
            }
            rowCells.push(cells);
            for (const cell of cells) {
                cellXCoords.push(cell.x);
            }
        }

        // 5. Find global column boundaries by clustering cell X coordinates
        cellXCoords.sort((a, b) => a - b);
        const columnStops: number[] = [];
        for (const x of cellXCoords) {
            if (columnStops.length === 0) {
                columnStops.push(x);
            } else {
                let found = false;
                for (let i = 0; i < columnStops.length; i++) {
                    if (Math.abs(columnStops[i] - x) < 20) { // 20 points tolerance for column start
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    columnStops.push(x);
                }
            }
        }
        columnStops.sort((a, b) => a - b);

        // 6. Map cells to global columns
        let currentPageText = '';
        for (const cells of rowCells) {
            const currentLine: string[] = new Array(columnStops.length).fill('');
            for (const cell of cells) {
                // Find closest column stop
                let closestIdx = 0;
                let minDiff = Infinity;
                for (let i = 0; i < columnStops.length; i++) {
                    const diff = Math.abs(columnStops[i] - cell.x);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestIdx = i;
                    }
                }
                // Append to column
                if (currentLine[closestIdx]) {
                    currentLine[closestIdx] += ' ' + cell.text;
                } else {
                    currentLine[closestIdx] = cell.text;
                }
            }
            
            // Clean up trailing empty columns
            while(currentLine.length > 0 && currentLine[currentLine.length - 1] === '') {
                currentLine.pop();
            }

            if (currentLine.length > 0) {
                const formattedLine = currentLine.map(col => {
                    if (col.includes(',') || col.includes('"')) {
                        return `"${col.replace(/"/g, '""')}"`;
                    }
                    return col;
                });
                currentPageText += formattedLine.join(',') + '\n';
            }
        }
        
        fullText += currentPageText + '\n';
      }
      
      console.log('Extracted text length:', fullText.length);
      const lines = fullText.split('\n').filter(line => line.trim() !== '');
      if (lines.length === 0) {
        setError('Could not extract data from PDF.');
        setProcessing(false);
        return;
      }

      // Use Papa.parse for more robust CSV parsing
      const results = Papa.parse(fullText, {
        header: false,
        skipEmptyLines: true,
        dynamicTyping: true,
      });

      if (results.errors.length > 0) {
        console.warn('CSV parsing warnings:', results.errors);
      }

      if (results.data.length === 0) {
        setError('No data found in PDF.');
        setProcessing(false);
        return;
      }

      // Generate generic headers Column 1, Column 2, etc. based on max columns
      let maxCols = 0;
      results.data.forEach((row: any) => {
        if (Array.isArray(row) && row.length > maxCols) {
          maxCols = row.length;
        }
      });

      const generatedHeaders = Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);
      
      // Map data to objects using generated headers
      const formattedData = results.data.map((row: any) => {
        const obj: any = {};
        generatedHeaders.forEach((header, i) => {
          obj[header] = row[i] !== undefined ? row[i] : '';
        });
        return obj;
      });

      setHeaders(generatedHeaders);
      setParsedData(formattedData);
      setSuccess('PDF parsed successfully. Ready to convert.');
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error('Error parsing PDF:', errorMsg);
      setError('Error parsing PDF: ' + errorMsg);
    } finally {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setProcessing(false);
    }
  };

  const parseCSV = (fileToParse: File) => {
    setProcessing(true);
    Papa.parse(fileToParse, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length > 0) {
          const cols = Object.keys(results.data[0] as object);
          setHeaders(cols);
          setParsedData(results.data);
          setSuccess('File parsed successfully. Ready to convert.');
          if (results.errors.length > 0) {
            console.warn('CSV parsing warnings:', results.errors);
          }
        } else {
          setError('The CSV file is empty or could not be parsed.');
        }
        setProcessing(false);
      },
      error: (error) => {
        setError(`Error parsing file: ${error.message}`);
        setProcessing(false);
      }
    });
  };

  const clearFile = () => {
    setFile(null);
    setParsedData([]);
    setHeaders([]);
    setError(null);
    setSuccess(null);
  };

  const downloadAsCSV = () => {
    if (parsedData.length === 0) return;
    
    const csvContent = Papa.unparse(parsedData);
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${file?.name.replace(/\.(csv|pdf)$/i, '') || 'converted'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAsText = () => {
    if (parsedData.length === 0) return;
    
    // Convert to tab-separated or formatted text
    const textContent = Papa.unparse(parsedData, { delimiter: '\t' });
    
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${file?.name.replace(/\.(csv|pdf)$/i, '') || 'converted'}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAsPDF = () => {
    if (parsedData.length === 0 || headers.length === 0) return;
    
    const doc = new jsPDF({
      orientation: headers.length > 6 ? 'landscape' : 'portrait',
    });
    
    const rows = parsedData.map(row => headers.map(header => row[header] || ''));
    
    doc.text(`Converted Data: ${file?.name || 'Document'}`, 14, 15);
    
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 20,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [220, 38, 38] }, // Match the red-600 theme
    });
    
    doc.save(`${file?.name.replace(/\.(csv|pdf)$/i, '') || 'converted'}.pdf`);
  };

  return (
    <div className="space-y-8 font-sans pb-12">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-8 sm:p-12 border border-brand/10 shadow-premium group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand/5 rounded-full -mr-48 -mt-48 blur-3xl group-hover:bg-brand/10 transition-colors duration-700"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gold/5 rounded-full -ml-48 -mb-48 blur-3xl group-hover:bg-gold/10 transition-colors duration-700"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-4 py-1.5 bg-brand/10 text-brand text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-brand/20 shadow-inner-light">
              File Utility
            </span>
            <div className="h-px w-12 bg-gradient-to-r from-brand/50 to-transparent"></div>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight mb-4 uppercase">
            File <span className="text-brand">Converter</span>
          </h1>
          <p className="text-slate-700 text-lg max-w-2xl font-bold leading-relaxed">
            Seamlessly convert between CSV and PDF formats. Perfect for preparing batch reports or extracting data from statements with precision.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Actions & Upload Section */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2.5rem] shadow-premium border border-brand/5 p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-brand/10 transition-colors"></div>
            
            <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-4 relative z-10 uppercase tracking-tight">
              <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center shadow-inner-light group-hover:scale-110 transition-transform">
                <RefreshCw className="w-6 h-6 text-brand" />
              </div>
              Conversion Type
            </h3>
            
            <div className="flex flex-col gap-4 relative z-10">
              <button
                onClick={() => { setConversionType('csv-to-pdf'); clearFile(); }}
                className={`group/btn relative flex items-center justify-between px-6 py-5 rounded-2xl text-sm font-black transition-all overflow-hidden border-2 ${
                  conversionType === 'csv-to-pdf' 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-brand/20 scale-[1.02]' 
                    : 'bg-white text-slate-600 hover:bg-brand/5 border-slate-100 hover:border-brand/20'
                }`}
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${conversionType === 'csv-to-pdf' ? 'bg-brand/20' : 'bg-slate-100 group-hover/btn:bg-brand/10'}`}>
                    <FileText className={`w-5 h-5 ${conversionType === 'csv-to-pdf' ? 'text-brand' : 'text-slate-400 group-hover/btn:text-brand'}`} />
                  </div>
                  <span className="uppercase tracking-wider">CSV to PDF/Text</span>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${conversionType === 'csv-to-pdf' ? 'bg-brand text-white scale-110' : 'bg-slate-100 opacity-0'}`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                {conversionType === 'csv-to-pdf' && (
                  <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-brand"></div>
                )}
              </button>

              <button
                onClick={() => { setConversionType('pdf-to-csv'); clearFile(); }}
                className={`group/btn relative flex items-center justify-between px-6 py-5 rounded-2xl text-sm font-black transition-all overflow-hidden border-2 ${
                  conversionType === 'pdf-to-csv' 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-gold/20 scale-[1.02]' 
                    : 'bg-white text-slate-600 hover:bg-gold/5 border-slate-100 hover:border-gold/20'
                }`}
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${conversionType === 'pdf-to-csv' ? 'bg-gold/20' : 'bg-slate-100 group-hover/btn:bg-gold/10'}`}>
                    <FileDown className={`w-5 h-5 ${conversionType === 'pdf-to-csv' ? 'text-gold' : 'text-slate-400 group-hover/btn:text-gold'}`} />
                  </div>
                  <span className="uppercase tracking-wider">PDF to CSV</span>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${conversionType === 'pdf-to-csv' ? 'bg-gold text-white scale-110' : 'bg-slate-100 opacity-0'}`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                {conversionType === 'pdf-to-csv' && (
                  <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-gold"></div>
                )}
              </button>

              <button
                onClick={() => { setConversionType('ai-pdf-extraction'); clearFile(); }}
                className={`group/btn relative flex items-center justify-between px-6 py-5 rounded-2xl text-sm font-black transition-all overflow-hidden border-2 ${
                  conversionType === 'ai-pdf-extraction' 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-brand/20 scale-[1.02]' 
                    : 'bg-white text-slate-600 hover:bg-brand/5 border-slate-100 hover:border-brand/20'
                }`}
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${conversionType === 'ai-pdf-extraction' ? 'bg-brand/20' : 'bg-slate-100 group-hover/btn:bg-brand/10'}`}>
                    <Eye className={`w-5 h-5 ${conversionType === 'ai-pdf-extraction' ? 'text-brand' : 'text-slate-400 group-hover/btn:text-brand'}`} />
                  </div>
                  <span className="uppercase tracking-wider">AI PDF Extraction</span>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${conversionType === 'ai-pdf-extraction' ? 'bg-brand text-white scale-110' : 'bg-slate-100 opacity-0'}`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                {conversionType === 'ai-pdf-extraction' && (
                  <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-brand"></div>
                )}
              </button>

              <button
                onClick={() => { setConversionType('ai-account-extraction'); clearFile(); }}
                className={`group/btn relative flex items-center justify-between px-6 py-5 rounded-2xl text-sm font-black transition-all overflow-hidden border-2 ${
                  conversionType === 'ai-account-extraction' 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-blue-500/20 scale-[1.02]' 
                    : 'bg-white text-slate-600 hover:bg-blue-50 border-slate-100 hover:border-blue-200'
                }`}
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${conversionType === 'ai-account-extraction' ? 'bg-blue-500/20' : 'bg-slate-100 group-hover/btn:bg-blue-100'}`}>
                    <CreditCard className={`w-5 h-5 ${conversionType === 'ai-account-extraction' ? 'text-blue-500' : 'text-slate-400 group-hover/btn:text-blue-500'}`} />
                  </div>
                  <span className="uppercase tracking-wider">Extract Account Details</span>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${conversionType === 'ai-account-extraction' ? 'bg-blue-500 text-white scale-110' : 'bg-slate-100 opacity-0'}`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                {conversionType === 'ai-account-extraction' && (
                  <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-blue-500"></div>
                )}
              </button>
            </div>

            <div className="mt-10">
              <label className={`relative flex flex-col items-center justify-center w-full h-56 px-6 transition-all duration-500 bg-slate-50/50 border-2 border-dashed rounded-[2.5rem] cursor-pointer group/upload ${
                file ? 'border-brand/40 bg-brand/5 shadow-inner-light' : 'border-slate-200 hover:border-brand/40 hover:bg-brand/5'
              }`}>
                <div className="flex flex-col items-center text-center relative z-10">
                  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-5 transition-all duration-500 shadow-premium ${
                    file ? 'bg-gradient-brand text-white scale-110' : 'bg-white text-slate-400 group-hover/upload:text-brand group-hover/upload:scale-110'
                  }`}>
                    <Upload className="w-10 h-10" />
                  </div>
                  <p className="text-base font-black text-slate-900 mb-1 uppercase tracking-tight">
                    {file ? file.name : 'Choose a file'}
                  </p>
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">
                    {file ? 'Click to change' : `Drop ${conversionType === 'csv-to-pdf' ? 'CSV' : 'PDF'} here`}
                  </p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept={conversionType === 'csv-to-pdf' ? '.csv' : '.pdf'}
                  onChange={handleFileChange}
                />
              </label>

              {file && (
                <div className="space-y-4 mt-6">
                  <button
                    onClick={handleConvert}
                    disabled={processing}
                    className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-gradient-brand text-white font-black rounded-2xl hover:opacity-90 transition-all shadow-premium hover-lift disabled:opacity-50 uppercase tracking-widest text-xs"
                  >
                    {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                    Convert File
                  </button>
                  <button
                    onClick={clearFile}
                    className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-white border-2 border-slate-100 text-slate-600 font-black rounded-2xl hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all hover-lift uppercase tracking-widest text-xs"
                  >
                    <X className="w-5 h-5" />
                    Remove File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview & Results Section */}
        <div className="lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {!file && !processing && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-full min-h-[450px] flex flex-col items-center justify-center bg-white rounded-[2.5rem] border-2 border-slate-100 border-dashed p-12 text-center shadow-premium relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <div className="w-28 h-28 bg-slate-50 rounded-full flex items-center justify-center mb-8 shadow-inner-light group-hover:scale-110 transition-transform duration-500 relative z-10">
                  <FileText className="w-14 h-14 text-slate-200 group-hover:text-brand/20 transition-colors" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3 relative z-10 uppercase tracking-tight">No File Selected</h3>
                <p className="text-slate-700 max-w-xs mx-auto font-bold relative z-10">
                  Upload a {conversionType === 'csv-to-pdf' ? 'CSV' : 'PDF'} file to see a premium preview and download in your desired format.
                </p>
              </motion.div>
            )}

            {processing && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full min-h-[450px] flex flex-col items-center justify-center bg-white rounded-[2.5rem] border border-brand/10 p-12 text-center shadow-premium relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-gold/5 animate-pulse"></div>
                <div className="relative z-10">
                  <div className="relative mb-8">
                    <div className="w-28 h-28 border-4 border-brand/10 border-t-brand rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-10 h-10 text-brand animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-3 uppercase tracking-tight">Processing File</h3>
                  <p className="text-slate-700 font-bold animate-pulse">Extracting data and preparing your premium preview...</p>
                </div>
              </motion.div>
            )}

            {parsedData.length > 0 && !processing && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-[2.5rem] shadow-premium border border-brand/5 overflow-hidden group">
                  <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6 bg-gradient-to-r from-slate-50/50 to-white">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-brand/10 rounded-2xl flex items-center justify-center text-brand shadow-inner-light group-hover:scale-110 transition-transform">
                        <Eye className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Data Preview</h3>
                        <p className="text-sm text-slate-700 font-black uppercase tracking-widest opacity-80">
                          {parsedData.length} rows extracted
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {conversionType === 'pdf-to-csv' || conversionType === 'ai-pdf-extraction' || conversionType === 'ai-account-extraction' ? (
                        <button
                          onClick={downloadAsCSV}
                          className="flex items-center gap-3 px-8 py-4 bg-gradient-brand text-white rounded-2xl font-black hover:opacity-90 transition-all shadow-premium hover-lift uppercase tracking-widest text-xs"
                        >
                          <FileDown className="w-5 h-5" />
                          Download CSV
                        </button>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={downloadAsPDF}
                            className="flex items-center gap-3 px-8 py-4 bg-gradient-brand text-white rounded-2xl font-black hover:opacity-90 transition-all shadow-premium hover-lift uppercase tracking-widest text-xs"
                          >
                            <FileDown className="w-5 h-5" />
                            PDF
                          </button>
                          <button
                            onClick={downloadAsText}
                            className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-premium hover-lift uppercase tracking-widest text-xs"
                          >
                            <FileText className="w-5 h-5" />
                            Text
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80">
                          {headers.map((header, i) => (
                            <th key={i} className="py-5 px-8 text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] whitespace-nowrap">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {parsedData.slice(0, 20).map((row, i) => (
                          <tr key={`${i}-desktop`} className="hover:bg-brand/5 transition-all duration-300 group/row">
                            {headers.map((header, j) => (
                              <td 
                                key={`${j}-desktop`} 
                                className={`py-5 px-8 text-sm font-bold whitespace-nowrap transition-colors ${
                                  header.toLowerCase().includes('amount') 
                                    ? 'text-success group-hover/row:text-success' 
                                    : 'text-slate-700 group-hover/row:text-brand'
                                }`}
                              >
                                {row[header]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden flex flex-col divide-y divide-slate-100">
                    {parsedData.slice(0, 20).map((row, i) => (
                      <div key={`${i}-mobile`} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex flex-col gap-2">
                          {headers.map((header, j) => (
                            <div key={`${j}-mobile`} className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{header}</span>
                              <span className={`text-sm font-bold ${
                                header.toLowerCase().includes('amount') ? 'text-success' : 'text-slate-900'
                              }`}>
                                {row[header]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {parsedData.length > 20 && (
                    <div className="p-5 bg-slate-50/80 text-center border-t border-slate-100">
                      <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">
                        Showing first 20 rows of {parsedData.length}
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-5 bg-brand/5 border border-brand/10 rounded-[2rem] flex items-center gap-4 text-brand shadow-premium">
                    <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-black uppercase tracking-tight">{error}</p>
                  </div>
                )}
                
                {success && (
                  <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex items-center gap-4 text-emerald-600 shadow-premium">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-black uppercase tracking-tight">{success}</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
