import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Scissors, Clock, AlertCircle, CheckCircle } from "lucide-react";
import React from 'react';

// Common constant for API URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Job interface used across components
export interface Job {
  id: string;
  input_pdf_filename: string;
  status: string;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  initial_tex_s3_path: string | null;
  final_tex_s3_path: string | null;
  final_pdf_s3_path: string | null;
  segmentation_tasks: Record<string, string> | null;
  model_used: string | null;
}

// Helper to format date strings
export const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return 'Invalid Date';
  }
};

// Convert technical status to user-friendly display name
export const getStatusDisplayName = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'rendering':
      return 'Processing Input';
    case 'processing_vlm':
      return 'OCR Processing';
    case 'awaiting_segmentation':
      return 'Ready for Segmentation';
    case 'segmentation_complete':
      return 'Segmentation Complete';
    case 'compilation_pending':
      return 'Compiling';
    case 'compilation_complete':
      return 'Complete';
    case 'completed':
      return 'Complete';
    case 'failed':
      return 'Failed';
    case 'compilation_failed':
      return 'Compilation Failed';
    case 'refinement_in_progress':
      return 'Refining';
    case 'refinement_complete':
      return 'Refinement Complete';
    case 'refinement_failed':
      return 'Refinement Failed';
    default:
      return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
};

// Helper to get status color (using Tailwind classes)
export const getStatusClass = (status: string): string => {
  switch (status) {
    case 'pending': return 'text-muted-foreground';
    case 'rendering':
    case 'processing_vlm':
    case 'compilation_pending':
    case 'refinement_in_progress':
      return 'text-blue-500 font-semibold';
    case 'awaiting_segmentation': return 'text-yellow-600 font-semibold';
    case 'segmentation_complete': return 'text-purple-500 font-semibold';
    case 'compilation_complete':
    case 'completed':
    case 'refinement_complete':
      return 'text-green-600 font-semibold';
    case 'failed':
    case 'compilation_failed':
    case 'refinement_failed':
      return 'text-red-600 font-semibold';
    default: return 'text-foreground';
  }
};

// Helper to get button visibility flags based on job status
export const getButtonVisibility = (job: Job) => {
  // PDF button - available only when compilation_complete
  const canDownloadPdf = ['compilation_complete', 'completed'].includes(job.status);
  
  // TeX download button - available when PDF is available
  const canDownloadTex = canDownloadPdf;
  
  // View TeX button - available after processing_vlm completes but NOT after compilation is complete
  const canViewTex = !['pending', 'rendering', 'processing_vlm', 'failed'].includes(job.status) && !canDownloadPdf;
  
  // Segmentation button - available only when awaiting_segmentation
  const canSegment = job.status === 'awaiting_segmentation';
  
  // Compile button - available only after segmentation_complete
  const canCompile = job.status === 'segmentation_complete';

  // For backward compatibility
  const canDownloadInitialTex = false;
  const canDownloadFinalTex = false;

  return {
    canDownloadInitialTex,
    canDownloadFinalTex,
    canDownloadPdf,
    canDownloadTex,
    canSegment,
    canCompile,
    canViewTex
  };
};

// Helper to get status icon component
export const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    case 'rendering':
    case 'processing_vlm':
    case 'compilation_pending':
    case 'refinement_in_progress':
      return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
    case 'awaiting_segmentation':
      return <Scissors className="h-4 w-4 text-yellow-600" />;
    case 'segmentation_complete':
      return <CheckCircle className="h-4 w-4 text-purple-500" />;
    case 'compilation_complete':
    case 'completed':
    case 'refinement_complete':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'failed':
    case 'compilation_failed':
    case 'refinement_failed':
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

// Original tailwind utility function
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
