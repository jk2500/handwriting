'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import CodeMirror from '@uiw/react-codemirror';
import { latex } from 'codemirror-lang-latex'; 
import { oneDark } from '@codemirror/theme-one-dark';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css'; // Import KaTeX CSS
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/utils';
import { ArrowLeftIcon, Loader2, SaveIcon, DownloadIcon } from 'lucide-react';

export default function EditJobPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [texContent, setTexContent] = useState<string>('');
  const [initialContent, setInitialContent] = useState<string>(''); // To check for changes
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Fetch initial TeX content
  useEffect(() => {
    if (!jobId) return;
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
        setInitialContent(data); // Store initial state
      })
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(`Failed to load TeX content: ${errorMessage}`);
        console.error("Fetch TeX error:", e);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [jobId]);

  // Callback for CodeMirror changes
  const onEditorChange = useCallback((value: string) => {
    setTexContent(value);
  }, []);

  // TODO: Implement Save functionality (requires backend endpoint)
  const handleSaveChanges = async () => {
    if (texContent === initialContent) {
      toast.info("No changes to save.");
      return;
    }
    setIsSaving(true);
    toast.info("Save functionality not yet implemented.");
    console.log("Saving changes for job:", jobId);
    console.log("New content:", texContent);
    // Placeholder: In a real implementation, you would make a PUT/POST request
    // to a new backend endpoint (e.g., /jobs/{jobId}/tex) to save the content.
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    setIsSaving(false);
    // On success, update initialContent to prevent repeated save prompts
    // setInitialContent(texContent);
    // toast.success("Changes saved successfully!");
  };

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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center h-[80vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/jobs" className="text-primary hover:text-primary/80 flex items-center gap-1 mb-4">
           <ArrowLeftIcon size={16} />
           <span>Back to Jobs</span>
        </Link>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg p-4 my-6">
           Error loading editor: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl page-animation">
      {/* Header with Back, Save, Download buttons */} 
      <div className="flex justify-between items-center mb-6">
        <Link href="/jobs" className="text-primary hover:text-primary/80 flex items-center gap-1">
            <ArrowLeftIcon size={16} />
            <span>Back to Jobs</span>
        </Link>
        <h1 className="text-2xl font-semibold">Edit TeX (Job: {jobId.substring(0, 8)}...)</h1>
        <div className="flex gap-2">
          {/* <Button 
            onClick={handleSaveChanges}
            disabled={isSaving || texContent === initialContent}
            size="sm"
            className="gap-1"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <SaveIcon className="h-4 w-4" />}
            <span>Save Changes</span>
          </Button> */}
          <Button 
            onClick={handleDownload}
            size="sm"
            variant="outline"
            className="gap-1"
          >
            <DownloadIcon className="h-4 w-4" />
            <span>Download .tex</span>
          </Button>
        </div>
      </div>

      {/* Editor and Preview Panes */} 
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[75vh]">
        {/* CodeMirror Editor Pane */} 
        <div className="border rounded-md overflow-hidden flex flex-col h-full">
          <div className="p-2 bg-muted/50 border-b text-sm font-medium">TeX Source</div>
          <div className="flex-grow overflow-auto">
             <CodeMirror
                value={texContent}
                height="100%"
                theme={oneDark} // Use the imported theme
                extensions={[latex()]} // Use the imported language support
                onChange={onEditorChange}
                style={{ height: '100%', fontSize: '0.9rem' }} // Ensure full height
            />
          </div>
        </div>

        {/* KaTeX Preview Pane (Very Basic - Placeholder) */} 
        <div className="border rounded-md overflow-auto h-full">
            <div className="p-2 bg-muted/50 border-b text-sm font-medium">Preview (Basic Math)</div>
             <div className="p-4 prose dark:prose-invert max-w-none">
                {/* Very basic rendering attempt - real preview is complex */}
                <p>Rendering full LaTeX previews client-side is challenging. This is a basic example showing only math rendering with KaTeX.</p>
                <p>Inline: <InlineMath math="E = mc^2" /></p>
                <p>Block:</p>
                <BlockMath math="\int_0^\infty x^2 dx" />
                <p>Raw content (first 500 chars):</p>
                <pre className="text-xs whitespace-pre-wrap">{texContent.substring(0, 500)}...</pre>
            </div>
        </div>
      </div>
    </div>
  );
} 