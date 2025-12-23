'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import CodeMirror from '@uiw/react-codemirror';
import { latex } from 'codemirror-lang-latex';
import { EditorView } from '@codemirror/view';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/utils';
import { 
  ArrowLeftIcon, 
  Loader2, 
  DownloadIcon, 
  SaveIcon, 
  MaximizeIcon, 
  MinimizeIcon, 
  CheckCircleIcon,
  ZoomInIcon,
  ZoomOutIcon,
  FileIcon
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Custom light theme for CodeMirror
const lightTheme = EditorView.theme({
  "&": {
    backgroundColor: "oklch(0.995 0.005 85)",
    color: "oklch(0.22 0.02 30)",
  },
  ".cm-content": {
    caretColor: "oklch(0.40 0.12 195)",
    fontFamily: "var(--font-geist-mono), monospace",
  },
  ".cm-cursor": {
    borderLeftColor: "oklch(0.40 0.12 195)",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "oklch(0.85 0.08 195 / 0.3)",
  },
  ".cm-activeLine": {
    backgroundColor: "oklch(0.96 0.008 85)",
  },
  ".cm-gutters": {
    backgroundColor: "oklch(0.975 0.008 85)",
    color: "oklch(0.55 0.015 30)",
    border: "none",
    borderRight: "1px solid oklch(0.90 0.01 85)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "oklch(0.94 0.01 85)",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 12px 0 8px",
  },
  ".cm-matchingBracket": {
    backgroundColor: "oklch(0.80 0.10 195 / 0.3)",
    outline: "1px solid oklch(0.50 0.12 195)",
  },
}, { dark: false });

export default function EditJobPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  const [texContent, setTexContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [lastPreviewContent, setLastPreviewContent] = useState<string>('');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to fetch and display the PDF preview
  const fetchPreview = useCallback(async (content: string) => {
    if (!jobId || !content) return;
    
    // Skip if content hasn't changed since last preview
    if (content === lastPreviewContent) return;
    
    console.log("Fetching preview...");
    setIsPreviewLoading(true);
    setPreviewError(null);
    setLastPreviewContent(content);
    let objectUrl: string | null = null;

    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/preview-with-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: content,
      });

      if (!response.ok) {
        let errorDetail = `Preview failed with status ${response.status}`;
        try {
          const errorText = await response.text();
           try {
               const errJson = JSON.parse(errorText);
               errorDetail = errJson.detail || errorText || errorDetail;
           } catch {
               errorDetail = errorText || errorDetail;
           }
        } catch {
        }
        throw new Error(errorDetail);
      }

      const blob = await response.blob();
      if (blob.type !== 'application/pdf') {
          throw new Error("Invalid response: Expected a PDF file.");
      }
      objectUrl = URL.createObjectURL(blob);

      setPreviewPdfUrl(prevUrl => {
        if (prevUrl) {
          URL.revokeObjectURL(prevUrl);
        }
        return objectUrl;
      });

    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Preview fetch/compilation error:", errorMessage);
      setPreviewError(`Preview failed: ${errorMessage}`);
       setPreviewPdfUrl(prevUrl => {
        if (prevUrl) {
          URL.revokeObjectURL(prevUrl);
        }
        return null;
       });
    } finally {
      setIsPreviewLoading(false);
      console.log("Preview fetch finished.");
    }
  }, [jobId, lastPreviewContent]);

  // Save the current TeX content
  const saveTexContent = async () => {
    if (!jobId || !texContent) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/tex`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: texContent,
      });

      if (!response.ok) {
        let errorDetail = `Save failed with status ${response.status}`;
        try {
          const errorText = await response.text();
          try {
            const errJson = JSON.parse(errorText);
            errorDetail = errJson.detail || errorText || errorDetail;
          } catch {
            errorDetail = errorText || errorDetail;
          }
        } catch {}
        throw new Error(errorDetail);
      }
      
      const data = await response.json();
      setLastSaved(new Date());
      toast.success("TeX file saved successfully");
      console.log("Save successful:", data.message);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to save: ${errorMessage}`);
      console.error("Save error:", e);
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch initial TeX content and generate initial preview
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!jobId || initialFetchDone.current) return;
    initialFetchDone.current = true;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/jobs/${jobId}/tex`)
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text().catch(() => 'Failed to read error response');
          throw new Error(`Failed to fetch TeX content: ${res.status} ${errorText}`);
        }
        return res.text();
      })
      .then((data) => {
        setTexContent(data);
        if (data) {
          fetchPreview(data);
        }
      })
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(`Failed to load TeX content: ${errorMessage}`);
        console.error("Fetch TeX error:", e);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [jobId, fetchPreview]);

  // Cleanup object URL and debounce timer on unmount
   useEffect(() => {
    return () => {
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
      }
       if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [previewPdfUrl]);

  // Callback for CodeMirror changes with debouncing
  const onEditorChange = useCallback((value: string) => {
    setTexContent(value);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      fetchPreview(value);
    }, 500);

  }, [fetchPreview]);

  // Handle download
  const handleDownload = () => {
    const blob = new Blob([texContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `job_${jobId}_edited.tex`; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast.success("TeX file downloaded.");
  };
  
  // Insert LaTeX templates
  const insertTemplate = (template: string) => {
    setTexContent(prev => prev + "\n" + template);
    fetchPreview(texContent + "\n" + template);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/jobs" className="text-primary hover:text-primary/80 flex items-center gap-1 mb-4 transition-colors">
           <ArrowLeftIcon size={16} />
           <span>Back to Jobs</span>
        </Link>
        <div className="bg-destructive/5 border border-destructive/20 text-destructive rounded-xl p-4 my-6">
           Error loading editor: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-7xl page-animation">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <Link href="/jobs" className="text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
              <ArrowLeftIcon size={16} />
              <span>Back to Jobs</span>
          </Link>
          <Badge variant="outline" className="flex items-center gap-1.5 font-medium">
            <FileIcon className="h-3 w-3" />
            <span>Job: {jobId.substring(0, 8)}...</span>
          </Badge>
          {lastSaved && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircleIcon className="h-3 w-3 text-green-600" />
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={handleDownload}
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                >
                  <DownloadIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download .tex file</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={saveTexContent}
                  size="sm"
                  variant="default"
                  className="gap-1.5"
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <SaveIcon className="h-4 w-4" />}
                  <span className="hidden sm:inline">Save</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save changes</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-4 p-3 bg-card rounded-xl border shadow-sm">
        <Select onValueChange={(value) => insertTemplate(value)}>
          <SelectTrigger className="h-8 w-[180px] bg-background">
            <SelectValue placeholder="Insert template..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="\begin{equation}\n  \n\end{equation}">Equation</SelectItem>
            <SelectItem value="\begin{figure}\n  \centering\n  \includegraphics[width=0.8\textwidth]{image}\n  \caption{Caption text}\n  \label{fig:label}\n\end{figure}">Figure</SelectItem>
            <SelectItem value="\begin{table}\n  \centering\n  \begin{tabular}{|c|c|}\n    \hline\n    Cell 1 & Cell 2 \\\\\n    \hline\n  \end{tabular}\n  \caption{Caption text}\n  \label{tab:label}\n\end{table}">Table</SelectItem>
            <SelectItem value="\begin{itemize}\n  \item First item\n  \item Second item\n\end{itemize}">Itemize</SelectItem>
            <SelectItem value="\begin{enumerate}\n  \item First item\n  \item Second item\n\end{enumerate}">Enumerate</SelectItem>
          </SelectContent>
        </Select>
        
        <Separator orientation="vertical" className="h-8" />
        
        <div className="flex gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setIsFullscreenPreview(!isFullscreenPreview)}
                >
                  {isFullscreenPreview ? <MinimizeIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFullscreenPreview ? "Exit fullscreen" : "Fullscreen preview"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))}
                  disabled={zoomLevel <= 50}
                >
                  <ZoomOutIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom out</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <span className="flex items-center justify-center text-xs font-medium w-12 text-muted-foreground">{zoomLevel}%</span>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setZoomLevel(prev => Math.min(200, prev + 10))}
                  disabled={zoomLevel >= 200}
                >
                  <ZoomInIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom in</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className={`grid ${isFullscreenPreview ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-4 h-[75vh]`}>
        {!isFullscreenPreview && (
          <div className="border rounded-xl overflow-hidden flex flex-col h-full shadow-sm bg-card">
            <div className="px-4 py-2.5 bg-muted/30 border-b text-sm font-semibold text-foreground">TeX Source</div>
            <div className="flex-grow overflow-auto">
              <CodeMirror
                value={texContent}
                height="100%"
                theme={lightTheme}
                extensions={[latex()]}
                onChange={onEditorChange}
                style={{ height: '100%', fontSize: '0.875rem' }}
              />
            </div>
          </div>
        )}

        <div className="border rounded-xl overflow-hidden flex flex-col h-full shadow-sm bg-card">
          <div className="px-4 py-2.5 bg-muted/30 border-b text-sm font-semibold flex justify-between items-center">
            <span>PDF Preview</span>
            {isPreviewLoading && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> 
                Compiling...
              </span>
            )}
          </div>
          <div className="flex-grow relative bg-muted/10">
            {previewError && (
              <div className="absolute inset-0 flex items-center justify-center p-4 bg-destructive/5">
                <div className="text-center max-w-md">
                  <p className="font-semibold mb-2 text-destructive">Preview Compilation Error</p>
                  <pre className="mt-1 text-xs whitespace-pre-wrap text-left max-h-60 overflow-auto bg-destructive/10 text-destructive p-3 rounded-lg">
                    {previewError}
                  </pre>
                </div>
              </div>
            )}
            {!previewError && previewPdfUrl && (
              <iframe
                src={previewPdfUrl}
                title="LaTeX Preview"
                className="w-full h-full border-0"
                style={{ 
                  transform: `scale(${zoomLevel/100})`, 
                  transformOrigin: 'top left',
                  width: `${10000/zoomLevel}%`,
                  height: `${10000/zoomLevel}%`
                }}
              />
            )}
            {!previewError && !previewPdfUrl && !isPreviewLoading && (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-muted-foreground">
                <span>{texContent ? 'Generating preview...' : 'Edit TeX source to see PDF preview'}</span>
              </div>
            )}
            {isPreviewLoading && !previewError && previewPdfUrl && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
