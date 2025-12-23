'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';
import Link from 'next/link';
import { UploadForm } from '@/components/UploadForm';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Scissors, PlayCircle, ChevronRight, AlertCircle, Sparkles } from "lucide-react";
import { toast } from 'sonner';
import { 
  API_BASE_URL, 
  type Job, 
  formatDate, 
  getButtonVisibility,
} from '@/lib/utils';
import { getStatusDisplayName, getStatusClass, getStatusIcon } from '@/lib/statusUtils';

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Job[] = await response.json();
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setJobs(data);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(`Failed to fetch jobs: ${errorMessage}`);
      console.error("Fetch error:", e);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchJobs();
  }, [fetchJobs]);

  useVisibilityPolling(fetchJobs, 10000);

  const recentJobs = jobs.slice(0, 4);

  const handleCompile = async (jobId: string) => {
    const toastId = toast.loading('Compiling document...');
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/compile`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to trigger compile' }));
        throw new Error(errorData.detail || `HTTP error! Status: ${response.status}`);
      }
      
      toast.success('Compilation triggered', { id: toastId });
      console.log(`Compilation triggered for job ${jobId}`);
      setTimeout(fetchJobs, 1000);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Compile error:", e);
      toast.error(`Failed to trigger compilation: ${errorMessage}`, { id: toastId });
    }
  };

  const StatusIcon = ({ status }: { status: string }) => getStatusIcon(status);

  return (
    <div className="container mx-auto px-4 py-10 page-animation">
      {/* Hero Section */}
      <div className="mb-12 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
          <Sparkles className="h-4 w-4" />
          <span>Powered by Vision Language Models</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight gradient-text">
          Handwriting Conversion
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Convert your handwritten PDFs to LaTeX with ease. Upload your document, segment diagrams, and compile to beautiful typeset output.
        </p>
      </div>

      {/* Upload Form */}
      <div className="max-w-4xl mx-auto mb-12">
        <UploadForm onUploadSuccess={fetchJobs} />
      </div>

      {/* Recent Jobs Section */}
      <div className="mb-6 flex items-center justify-between max-w-4xl mx-auto">
        <h2 className="text-xl font-semibold flex items-center gap-2.5 text-foreground">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          Recent Jobs
        </h2>
        <Link href="/jobs">
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            View All Jobs
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {loading && jobs.length === 0 && (
        <div className="flex justify-center items-center p-16 max-w-4xl mx-auto">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary"></div>
            <p className="text-sm text-muted-foreground">Loading jobs...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-destructive/5 border border-destructive/20 text-destructive rounded-xl p-4 my-4 flex items-start gap-3 max-w-4xl mx-auto">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium">Error loading jobs</h3>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      )}

      {!error && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden max-w-4xl mx-auto">
          <Table>
            {recentJobs.length === 0 && !loading ? (
              <TableCaption className="py-8">No jobs found. Upload a PDF to get started.</TableCaption>
            ) : (
              <TableCaption className="py-4">
                Your most recent conversion jobs.{' '}
                <Link href="/jobs" className="text-primary hover:underline font-medium">
                  View all
                </Link>
              </TableCaption>
            )}
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b bg-muted/30">
                <TableHead className="w-[250px] font-semibold">Filename</TableHead>
                <TableHead className="w-[140px] font-semibold">Status</TableHead>
                <TableHead className="w-[120px] font-semibold">Created</TableHead>
                <TableHead className="w-[100px] font-semibold">Model</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentJobs.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No jobs found.
                  </TableCell>
                </TableRow>
              ) : (
                recentJobs.map((job) => {
                  const { 
                    canDownloadPdf,
                    canSegment,
                    canCompile,
                    canViewTex
                  } = getButtonVisibility(job);
                  
                  return (
                    <TableRow key={job.id} className="table-row-hover">
                      <TableCell className="font-medium truncate max-w-[250px]" title={job.input_pdf_filename || 'N/A'}>
                        {job.input_pdf_filename || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <StatusIcon status={job.status} />
                          <span className={getStatusClass(job.status)}>
                            {getStatusDisplayName(job.status)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(job.created_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{job.model_used || 'N/A'}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {canViewTex && (
                          <Button
                            variant="outline"
                            size="sm"
                            title="View and edit TeX file"
                            className="gap-1.5"
                            asChild
                          >
                            <Link href={`/jobs/${job.id}/edit`}>
                              <FileText className="h-3.5 w-3.5" />
                              <span>View TeX</span>
                            </Link>
                          </Button>
                        )}
                        
                        {canSegment && (
                          <Button
                            variant="default"
                            size="sm"
                            title="Segment this job"
                            className="gap-1.5 shadow-sm"
                            asChild
                          >
                            <Link href={`/jobs/${job.id}/segment`}>
                              <Scissors className="h-3.5 w-3.5" />
                              <span>Segment</span>
                            </Link>
                          </Button>
                        )}
                        
                        {canCompile && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleCompile(job.id)}
                            title="Compile segmented document"
                            className="gap-1.5"
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            <span>Compile</span>
                          </Button>
                        )}
                        
                        {canDownloadPdf && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`${API_BASE_URL}/jobs/${job.id}/pdf`, '_blank')}
                            title="Download PDF file"
                            className="gap-1.5"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>PDF</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
