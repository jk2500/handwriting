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
import { FileText, Scissors, PlayCircle, ChevronRight, AlertCircle } from "lucide-react";
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
      // Sort by creation date (newest first)
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setJobs(data);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(`Failed to fetch jobs: ${errorMessage}`);
      console.error("Fetch error:", e);
      setJobs([]); // Clear jobs on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchJobs();
  }, [fetchJobs]);

  useVisibilityPolling(fetchJobs, 10000);

  // Get only the 4 most recent jobs for the home page
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
      // Refresh job list shortly after to hopefully catch status update
      setTimeout(fetchJobs, 1000);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Compile error:", e);
      toast.error(`Failed to trigger compilation: ${errorMessage}`, { id: toastId });
    }
  };

  // Use the status icon from utility
  const StatusIcon = ({ status }: { status: string }) => getStatusIcon(status);

  return (
    <div className="container mx-auto px-4 py-8 page-animation">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold mb-4 text-center bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          Handwriting Conversion
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          Convert your handwritten PDFs to LaTeX with ease. Upload your PDF, segment diagrams, and compile.
        </p>
      </div>

      <div className="max-w-4xl mx-auto mb-8">
        <UploadForm onUploadSuccess={fetchJobs} />
      </div>

      <div className="mb-6 flex items-center justify-between max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Recent Jobs
        </h2>
        <Link href="/jobs">
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex items-center gap-1"
          >
            View All Jobs
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {loading && jobs.length === 0 && (
        <div className="flex justify-center items-center p-12 max-w-4xl mx-auto">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg p-4 my-4 flex items-start gap-3 max-w-4xl mx-auto">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium">Error loading jobs</h3>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {!error && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden card-hover max-w-4xl mx-auto">
          <Table>
            {recentJobs.length === 0 && !loading ? (
              <TableCaption>No jobs found. Upload a PDF to get started.</TableCaption>
            ) : (
              <TableCaption>Your most recent conversion jobs. <Link href="/jobs" className="text-primary hover:underline">View all</Link></TableCaption>
            )}
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Filename</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[120px]">Created</TableHead>
                <TableHead className="w-[100px]">Model</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentJobs.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No jobs found.
                  </TableCell>
                </TableRow>
              ) : (
                recentJobs.map((job) => {
                  const { 
                    // canDownloadInitialTex, // Commented out unused variable
                    // canDownloadFinalTex, // Commented out unused variable
                    canDownloadPdf,
                    canSegment,
                    canCompile,
                    canViewTex
                  } = getButtonVisibility(job);
                  
                  return (
                    <TableRow key={job.id} className="hover:bg-muted/40 transition-colors">
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
                      <TableCell>{formatDate(job.created_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{job.model_used || 'N/A'}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {/* View TeX Button */}
                        {canViewTex && (
                          <Link href={`/jobs/${job.id}/edit`} passHref legacyBehavior>
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              title="View and edit TeX file"
                              className="gap-1 button-hover-effect"
                            >
                              <a>
                                <FileText className="h-3.5 w-3.5" />
                                <span>View TeX</span>
                              </a>
                            </Button>
                          </Link>
                        )}
                        
                        {/* Segmentation Button - only show when awaiting segmentation */}
                        {canSegment && (
                          <Link href={`/jobs/${job.id}/segment`} passHref legacyBehavior>
                            <Button
                              asChild
                              variant="default"
                              size="sm"
                              title="Segment this job"
                              className="gap-1 button-hover-effect"
                            >
                              <a>
                                <Scissors className="h-3.5 w-3.5" />
                                <span>Segment</span>
                              </a>
                            </Button>
                          </Link>
                        )}
                        
                        {/* Compile Button - only show after segmentation is complete */}
                        {canCompile && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleCompile(job.id)}
                            title="Compile segmented document"
                            className="gap-1 button-hover-effect"
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            <span>Compile</span>
                          </Button>
                        )}
                        
                        {/* PDF Button - only show after compilation */}
                        {canDownloadPdf && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`${API_BASE_URL}/jobs/${job.id}/pdf`, '_blank')}
                            title="Download PDF file"
                            className="gap-1 button-hover-effect"
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
