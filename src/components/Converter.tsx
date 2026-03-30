import React, { useState } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.js?url';
import { Upload, FileText, FileDown, Loader2, AlertCircle, X, CheckCircle2, RefreshCw, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from "@google/genai";

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function Converter() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [conversionType, setConversionType] = useState<'csv-to-pdf' | 'pdf-to-csv' | 'ai-pdf-extraction'>('csv-to-pdf');

  const extractDataWithAI = async (fileToParse: File) => {
    setProcessing(true);
    setError(null);
    setSuccess(null);
    try {
      // 1. Extract text from PDF
      const arrayBuffer = await fileToParse.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
      }

      // 2. Call Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `You are a highly accurate data extraction tool. I will provide you with a PDF document (e.g., a bank statement or invoice). Your job is to extract ONLY the following three fields from the document:

1. Account Number

2. Account Name

3. Amount

Ignore all other text, dates, addresses, and irrelevant numbers.
Output the extracted data STRICTLY in standard CSV format. Include a header row: Account Number,Account Name,Amount. Do not include any markdown formatting, conversational text, or explanations. Only return the raw CSV text.

Here is the document text:
${fullText}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const csvText = response.text;
      if (!csvText) {
          throw new Error('No data extracted');
      }

      // 3. Parse CSV
      const results = Papa.parse(csvText.trim(), {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
      });

      if (results.errors.length > 0) {
          throw new Error('Error parsing extracted data: ' + results.errors[0].message);
      }

      if (results.data.length === 0) {
          throw new Error('No data found in extracted CSV.');
      }

      setHeaders(Object.keys(results.data[0] as object));
      setParsedData(results.data);
      setSuccess('Data extracted successfully.');

    } catch (err) {
      console.error('Error extracting data:', err);
      setError('Error extracting data: ' + err);
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
        return;
      }
      if (conversionType === 'pdf-to-csv' || conversionType === 'ai-pdf-extraction') {
        if (selectedFile.type !== 'application/pdf' && !selectedFile.name.endsWith('.pdf')) {
          setError('Please select a valid PDF file.');
          setFile(null);
          setParsedData([]);
          setHeaders([]);
          return;
        }
      }
      setFile(selectedFile);
      setError(null);
      setSuccess(null);
    }
  };

  const handleConvert = () => {
    if (!file) return;
    if (conversionType === 'csv-to-pdf') {
      parseCSV(file);
    } else if (conversionType === 'pdf-to-csv') {
      parsePDF(file);
    } else {
      extractDataWithAI(file);
    }
  };

  const parsePDF = async (fileToParse: File) => {
    setProcessing(true);
    console.log('Parsing PDF:', fileToParse.name);
    try {
      const arrayBuffer = await fileToParse.arrayBuffer();
      console.log('PDF arrayBuffer loaded, size:', arrayBuffer.byteLength);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      console.log('PDF loaded, pages:', pdf.numPages);
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
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
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });

      console.log('Papa.parse results:', results);

      if (results.errors.length > 0) {
        setError('Error parsing extracted PDF data: ' + results.errors[0].message);
        setProcessing(false);
        return;
      }

      if (results.data.length === 0) {
        setError('No data found in PDF.');
        setProcessing(false);
        return;
      }

      const cols = Object.keys(results.data[0] as object);
      setHeaders(cols);
      setParsedData(results.data);
      setSuccess('PDF parsed successfully. Ready to convert.');
    } catch (err) {
      console.error('Error parsing PDF:', err);
      setError('Error parsing PDF: ' + err);
    } finally {
      setProcessing(false);
    }
  };

  const parseCSV = (fileToParse: File) => {
    setProcessing(true);
    Papa.parse(fileToParse, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError('Error parsing CSV file. Please check the format.');
          setProcessing(false);
          return;
        }
        
        if (results.data.length > 0) {
          const cols = Object.keys(results.data[0] as object);
          setHeaders(cols);
          setParsedData(results.data);
          setSuccess('File parsed successfully. Ready to convert.');
        } else {
          setError('The CSV file is empty.');
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
    link.setAttribute('download', `${file?.name.replace('.pdf', '') || 'converted'}.csv`);
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
    link.setAttribute('download', `${file?.name.replace('.csv', '') || 'converted'}.txt`);
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
    
    doc.save(`${file?.name.replace('.csv', '') || 'converted'}.pdf`);
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-8 sm:p-10 border border-slate-100 shadow-sm glass-card">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold/5 rounded-full -ml-32 -mb-32 blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-3 py-1 bg-brand/10 text-brand text-[10px] font-black uppercase tracking-widest rounded-full">
              File Utility
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-2">
            File <span className="text-brand">Converter</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-xl">
            Seamlessly convert between CSV and PDF formats. Perfect for preparing batch reports or extracting data from statements.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Actions & Upload Section */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 glass-card">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-brand" />
              </div>
              Conversion Type
            </h3>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setConversionType('csv-to-pdf'); clearFile(); }}
                className={`group relative flex items-center justify-between px-6 py-4 rounded-2xl text-sm font-bold transition-all overflow-hidden ${
                  conversionType === 'csv-to-pdf' 
                    ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                }`}
              >
                <div className="flex items-center gap-3 relative z-10">
                  <FileText className={`w-5 h-5 ${conversionType === 'csv-to-pdf' ? 'text-brand' : 'text-slate-400'}`} />
                  <span>CSV to PDF/Text</span>
                </div>
                {conversionType === 'csv-to-pdf' && (
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-brand"></div>
                )}
                <CheckCircle2 className={`w-4 h-4 relative z-10 transition-opacity ${conversionType === 'csv-to-pdf' ? 'opacity-100' : 'opacity-0'}`} />
              </button>

              <button
                onClick={() => { setConversionType('pdf-to-csv'); clearFile(); }}
                className={`group relative flex items-center justify-between px-6 py-4 rounded-2xl text-sm font-bold transition-all overflow-hidden ${
                  conversionType === 'pdf-to-csv' 
                    ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                }`}
              >
                <div className="flex items-center gap-3 relative z-10">
                  <FileDown className={`w-5 h-5 ${conversionType === 'pdf-to-csv' ? 'text-gold' : 'text-slate-400'}`} />
                  <span>PDF to CSV</span>
                </div>
                {conversionType === 'pdf-to-csv' && (
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-gold"></div>
                )}
                <CheckCircle2 className={`w-4 h-4 relative z-10 transition-opacity ${conversionType === 'pdf-to-csv' ? 'opacity-100' : 'opacity-0'}`} />
              </button>

              <button
                onClick={() => { setConversionType('ai-pdf-extraction'); clearFile(); }}
                className={`group relative flex items-center justify-between px-6 py-4 rounded-2xl text-sm font-bold transition-all overflow-hidden ${
                  conversionType === 'ai-pdf-extraction' 
                    ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                }`}
              >
                <div className="flex items-center gap-3 relative z-10">
                  <Eye className={`w-5 h-5 ${conversionType === 'ai-pdf-extraction' ? 'text-brand' : 'text-slate-400'}`} />
                  <span>AI PDF Extraction</span>
                </div>
                {conversionType === 'ai-pdf-extraction' && (
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-brand"></div>
                )}
                <CheckCircle2 className={`w-4 h-4 relative z-10 transition-opacity ${conversionType === 'ai-pdf-extraction' ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            </div>

            <div className="mt-8">
              <label className={`relative flex flex-col items-center justify-center w-full h-48 px-6 transition-all duration-300 bg-slate-50/50 border-2 border-dashed rounded-[2rem] cursor-pointer group ${
                file ? 'border-brand/30 bg-brand/5' : 'border-slate-200 hover:border-brand/40 hover:bg-slate-50'
              }`}>
                <div className="flex flex-col items-center text-center">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
                    file ? 'bg-brand text-white' : 'bg-white text-slate-400 group-hover:text-brand shadow-sm'
                  }`}>
                    <Upload className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-black text-slate-900 mb-1">
                    {file ? file.name : 'Choose a file'}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
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
                <div className="space-y-3 mt-4">
                  <button
                    onClick={handleConvert}
                    disabled={processing}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand text-white font-bold rounded-2xl hover:bg-brand-dark transition-all shadow-xl shadow-brand/20 hover-lift disabled:opacity-50"
                  >
                    {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                    Convert File
                  </button>
                  <button
                    onClick={clearFile}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all hover-lift"
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
                className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-[2rem] border border-slate-100 border-dashed p-12 text-center glass-card"
              >
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <FileText className="w-12 h-12 text-slate-200" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">No File Selected</h3>
                <p className="text-slate-500 max-w-xs mx-auto">
                  Upload a {conversionType === 'csv-to-pdf' ? 'CSV' : 'PDF'} file to see a preview and download in your desired format.
                </p>
              </motion.div>
            )}

            {processing && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-[2rem] border border-slate-100 p-12 text-center glass-card"
              >
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-brand/10 border-t-brand rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-brand animate-pulse" />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mt-8 mb-2">Processing File</h3>
                <p className="text-slate-500 animate-pulse">Extracting data and preparing preview...</p>
              </motion.div>
            )}

            {parsedData.length > 0 && !processing && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden glass-card">
                  <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center text-brand">
                        <Eye className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900">Data Preview</h3>
                        <p className="text-sm text-slate-500 font-medium">{parsedData.length} rows extracted successfully</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {conversionType === 'pdf-to-csv' ? (
                        <button
                          onClick={downloadAsCSV}
                          className="flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-2xl font-bold hover:bg-brand-dark transition-all shadow-xl shadow-brand/20 hover-lift"
                        >
                          <FileDown className="w-5 h-5" />
                          Download CSV
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={downloadAsPDF}
                            className="flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-2xl font-bold hover:bg-brand-dark transition-all shadow-xl shadow-brand/20 hover-lift"
                          >
                            <FileDown className="w-5 h-5" />
                            PDF
                          </button>
                          <button
                            onClick={downloadAsText}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 hover-lift"
                          >
                            <FileText className="w-5 h-5" />
                            Text
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-50">
                          {headers.map((header, i) => (
                            <th key={i} className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {parsedData.slice(0, 20).map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-all duration-200">
                            {headers.map((header, j) => (
                              <td key={j} className="py-4 px-6 text-sm text-slate-600 font-medium whitespace-nowrap">
                                {row[header]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {parsedData.length > 20 && (
                    <div className="p-4 bg-slate-50 text-center border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Showing first 20 rows of {parsedData.length}
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-4 bg-brand/5 border border-brand/10 rounded-2xl flex items-center gap-3 text-brand">
                    <AlertCircle className="w-5 h-5" />
                    <p className="text-sm font-bold">{error}</p>
                  </div>
                )}
                
                {success && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <p className="text-sm font-bold">{success}</p>
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
