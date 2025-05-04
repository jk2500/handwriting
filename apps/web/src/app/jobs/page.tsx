'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
import { FileText, Scissors, PlayCircle, ArrowUpDown, RotateCcw, AlertCircle } from "lucide-react";
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_BASE_URL, type Job, formatDate, getButtonVisibility } from '@/lib/utils';
import { getStatusDisplayName, getStatusClass, getStatusIcon } from '@/lib/statusUtils';

export default function JobsPage() {
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // Default to newest first

  const fetchJobs = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Job[] = await response.json();
      // Sort by creation date (newest first by default)
      data.sort((a, b) => {
        if (sortOrder === 'desc') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        } else {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
      });
      setAllJobs(data);
      applyFilters(data, searchTerm, statusFilter);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(`Failed to fetch jobs: ${errorMessage}`);
      console.error("Fetch error:", e);
      setAllJobs([]);
      setFilteredJobs([]);
    } finally {
      setLoading(false);
    }
  }, [sortOrder, searchTerm, statusFilter]);

  // Apply filters to jobs
  const applyFilters = (jobs: Job[], search: string, status: string) => {
    let filtered = [...jobs];
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(job => 
        job.input_pdf_filename?.toLowerCase().includes(searchLower) ||
        job.id.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply status filter
    if (status !== 'all') {
      filtered = filtered.filter(job => job.status === status);
    }
    
    setFilteredJobs(filtered);
  };

  // Handle search term change
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    applyFilters(allJobs, newSearchTerm, statusFilter);
  };

  // Handle status filter change
  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    applyFilters(allJobs, searchTerm, value);
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    setSortOrder(newOrder);
    
    const sortedJobs = [...filteredJobs].sort((a, b) => {
      if (newOrder === 'desc') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
    });
    
    setFilteredJobs(sortedJobs);
  };

  // Handle compilation
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
      // Refresh job list shortly after
      setTimeout(fetchJobs, 1000);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Compile error:", e);
      toast.error(`Failed to trigger compilation: ${errorMessage}`, { id: toastId });
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchJobs();
    
    // Set up polling for updates
    const intervalId = setInterval(fetchJobs, 10000);
    return () => clearInterval(intervalId);
  }, [fetchJobs]);

  // Use the status icon from utility
  const StatusIcon = ({ status }: { status: string }) => getStatusIcon(status);

  // Derived states for button disabling based on job status
  // const canDownloadInitialTex = job.status !== JobStatus.Pending && job.status !== JobStatus.Processing;
  // const canDownloadFinalTex = job.status === JobStatus.Completed || job.status === JobStatus.Failed || job.status === JobStatus.CompletedWithWarnings;

  // const handleCopyJobId = () => {
  //   navigator.clipboard.writeText(job.id)
  // }

  return (
    <div className="container mx-auto px-4 py-8 page-animation">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">All Conversion Jobs</h1>
        <p className="text-muted-foreground">View and manage all your LaTeX conversion jobs.</p>
      </div>

      {/* Filters & Controls */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle>Filters & Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="search" className="mb-2 block">Search Jobs</Label>
              <Input
                id="search"
                placeholder="Search by filename or ID..."
                value={searchTerm}
                onChange={handleSearch}
                className="max-w-full"
              />
            </div>
            
            <div>
              <Label htmlFor="status-filter" className="mb-2 block">Filter by Status</Label>
              <Select value={statusFilter} onValueChange={handleStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rendering">Rendering</SelectItem>
                    <SelectItem value="processing_vlm">Processing VLM</SelectItem>
                    <SelectItem value="awaiting_segmentation">Awaiting Segmentation</SelectItem>
                    <SelectItem value="segmentation_complete">Segmentation Complete</SelectItem>
                    <SelectItem value="compilation_pending">Compilation Pending</SelectItem>
                    <SelectItem value="compilation_complete">Compilation Complete</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end space-x-2">
              <Button 
                variant="outline" 
                onClick={toggleSortOrder} 
                className="gap-1 flex-1"
              >
                <ArrowUpDown className="h-4 w-4" />
                Sort: {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
              </Button>
              
              <Button 
                variant="secondary" 
                onClick={() => fetchJobs()}
                className="gap-1"
              >
                <RotateCcw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && allJobs.length === 0 && (
        <div className="flex justify-center items-center p-12">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg p-4 my-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium">Error loading jobs</h3>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Jobs Table */}
      {!error && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <Table>
            {filteredJobs.length === 0 && !loading ? (
              <TableCaption>
                {searchTerm || statusFilter !== 'all' 
                  ? 'No jobs match your filters. Try adjusting your search criteria.'
                  : 'No jobs found. Upload a PDF to get started.'}
              </TableCaption>
            ) : (
              <TableCaption>
                Showing {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}
                {searchTerm || statusFilter !== 'all' ? ' matching your filters' : ''}
              </TableCaption>
            )}
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Filename</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'No jobs match your filters.'
                      : 'No jobs found.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredJobs.map((job) => {
                  const { 
                    // canDownloadInitialTex, // Commented out
                    // canDownloadFinalTex, // Commented out
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
                        
                        {/* Segmentation Button */}
                        {canSegment && (
                          <Link href={`/jobs/${job.id}/segment`} passHref legacyBehavior>
                            <Button
                              asChild
                              variant="default"
                              size="sm"
                              title="Segment this job"
                              className="gap-1"
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