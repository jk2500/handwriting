import React from 'react';
import { Clock, Scissors, CheckCircle, AlertCircle } from "lucide-react";

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