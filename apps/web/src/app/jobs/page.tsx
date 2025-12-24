'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';
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
import { FileText, Scissors, PlayCircle, ArrowUpDown, RotateCcw, AlertCircle, Search, Filter, HelpCircle } from "lucide-react";
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
import { API_BASE_URL, type Job, formatDate, getButtonVisibility, preloadJobImages, shouldPreloadImages } from '@/lib/utils';
import { getStatusDisplayName, getStatusClass, getStatusIcon } from '@/lib/statusUtils';

export default function JobsPage() {
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchJobs = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Job[] = await response.json();
      data.sort((a, b) => {
        if (sortOrder === 'desc') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        } else {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
      });
      setAllJobs(data);
      applyFilters(data, searchTerm, statusFilter);
      
      // Preload images for jobs that are processing or ready for segmentation
      data.forEach(job => {
        if (shouldPreloadImages(job.status)) {
          preloadJobImages(job.id);
        }
      });
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

  const applyFilters = (jobs: Job[], search: string, status: string) => {
    let filtered = [...jobs];
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(job => 
        job.input_pdf_filename?.toLowerCase().includes(searchLower) ||
        job.id.toLowerCase().includes(searchLower)
      );
    }
    
    if (status !== 'all') {
      filtered = filtered.filter(job => job.status === status);
    }
    
    setFilteredJobs(filtered);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    applyFilters(allJobs, newSearchTerm, statusFilter);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    applyFilters(allJobs, searchTerm, value);
  };

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
  }, [fetchJobs]);

  useVisibilityPolling(fetchJobs, 10000);

  const StatusIcon = ({ status }: { status: string }) => getStatusIcon(status);

  return (
    <div className="container mx-auto px-4 py-10 page-animation">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 tracking-tight gradient-text">All Conversion Jobs</h1>
        <p className="text-muted-foreground">View and manage all your LaTeX conversion jobs.</p>
      </div>

      {/* Instructions */}
      <Card className="mb-6 shadow-sm border-0 bg-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div><strong className="text-foreground">View TeX</strong> - Review and edit the generated LaTeX code before segmentation.</div>
            </div>
            <div className="flex items-start gap-2">
              <Scissors className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div><strong className="text-foreground">Segment</strong> - Draw bounding boxes around diagrams/figures to extract them.</div>
            </div>
            <div className="flex items-start gap-2">
              <PlayCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div><strong className="text-foreground">Compile</strong> - Generate the final PDF with extracted figures embedded.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters & Controls */}
      <Card className="mb-6 shadow-sm border-0 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            Filters & Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="search" className="mb-2 block text-sm font-medium">Search Jobs</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by filename or ID..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pl-9 bg-background"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="status-filter" className="mb-2 block text-sm font-medium">Filter by Status</Label>
              <Select value={statusFilter} onValueChange={handleStatusFilter}>
                <SelectTrigger id="status-filter" className="bg-background">
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
                className="gap-1.5 flex-1"
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
              </Button>
              
              <Button 
                variant="secondary" 
                onClick={() => fetchJobs()}
                className="gap-1.5"
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
        <div className="flex justify-center items-center p-16">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary"></div>
            <p className="text-sm text-muted-foreground">Loading jobs...</p>
          </div>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="bg-destructive/5 border border-destructive/20 text-destructive rounded-xl p-4 my-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium">Error loading jobs</h3>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Jobs Table */}
      {!error && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <Table>
            {filteredJobs.length === 0 && !loading ? (
              <TableCaption className="py-8">
                {searchTerm || statusFilter !== 'all' 
                  ? 'No jobs match your filters. Try adjusting your search criteria.'
                  : 'No jobs found. Upload a PDF to get started.'}
              </TableCaption>
            ) : (
              <TableCaption className="py-4">
                Showing {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}
                {searchTerm || statusFilter !== 'all' ? ' matching your filters' : ''}
              </TableCaption>
            )}
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b bg-muted/30">
                <TableHead className="w-[250px] font-semibold">Filename</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="font-semibold">Model</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'No jobs match your filters.'
                      : 'No jobs found.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredJobs.map((job) => {
                  const { 
                    canDownloadPdf,
                    canDownloadTex,
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
                        
                        {canDownloadTex && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`${API_BASE_URL}/jobs/${job.id}/tex`, '_blank')}
                            title="Download TeX file"
                            className="gap-1.5"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>TeX</span>
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
