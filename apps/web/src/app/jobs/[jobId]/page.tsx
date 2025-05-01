'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation'; // Use useParams for App Router

interface JobStatusDetails {
  job_id: string;
  status: string;
  error_message: string | null;
}

// Re-use from dashboard or move to a shared utils file
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const getStatusColor = (status: string): string => { switch (status) { case 'pending': return 'text-gray-500'; case 'rendering': case 'processing_vlm': case 'compilation_pending': case 'refinement_in_progress': return 'text-blue-500'; case 'awaiting_segmentation': return 'text-yellow-600'; case 'segmentation_complete': return 'text-purple-500'; case 'compilation_complete': case 'completed': case 'refinement_complete': return 'text-green-600'; case 'failed': case 'compilation_failed': case 'refinement_failed': return 'text-red-600'; default: return 'text-black'; } };

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.jobId as string; // Get jobId from URL

  const [jobStatus, setJobStatus] = useState<JobStatusDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // TODO: Fetch full job details if needed, not just status

  useEffect(() => {
    if (!jobId) return; // Don't fetch if jobId isn't available yet

    const fetchJobStatus = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/status`);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Job not found.`);
            } else {
                 throw new Error(`HTTP error! status: ${response.status}`);
            }
        }
        const data: JobStatusDetails = await response.json();
        setJobStatus(data);
      } catch (e: any) {
        setError(`Failed to fetch job status: ${e.message}`);
        console.error("Fetch status error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchJobStatus();
    // TODO: Implement polling or use SWR/React Query for automatic refresh
  }, [jobId]); // Re-run effect if jobId changes

  // Determine file availability based on status (simplified)
  const canDownloadTex = jobStatus?.status && !['pending', 'rendering', 'processing_vlm'].includes(jobStatus.status);
  const canDownloadPdf = jobStatus?.status === 'compilation_complete';
  const needsSegmentation = jobStatus?.status === 'awaiting_segmentation' || jobStatus?.status === 'segmentation_complete';

  return (
    <main className="container mx-auto p-4 font-[family-name:var(--font-geist-sans)]">
      <Link href="/" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Dashboard</Link>

      <h1 className="text-2xl font-bold mb-2">Job Details</h1>
      <p className="mb-4 text-sm text-gray-500">ID: {jobId}</p>

      {loading && <p>Loading job details...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {jobStatus && !loading && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Status</h2>
          <p className={`text-xl font-semibold mb-4 ${getStatusColor(jobStatus.status)}`}>
            {jobStatus.status.replace(/_/g, ' ').toUpperCase()}
          </p>
          {jobStatus.error_message && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                  <strong className="font-bold">Error: </strong>
                  <span className="block sm:inline">{jobStatus.error_message}</span>
              </div>
          )}

          <h2 className="text-lg font-medium text-gray-900 mb-3">Actions</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* TeX Download */} 
            <a
              href={canDownloadTex ? `${API_BASE_URL}/jobs/${jobId}/tex` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-4 py-2 rounded font-medium text-white text-center ${canDownloadTex ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
              aria-disabled={!canDownloadTex}
              onClick={(e) => !canDownloadTex && e.preventDefault()} // Prevent click if disabled
            >
              Download TeX
            </a>

            {/* PDF Download/View */} 
            <a
              href={canDownloadPdf ? `${API_BASE_URL}/jobs/${jobId}/pdf` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-4 py-2 rounded font-medium text-white text-center ${canDownloadPdf ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
              aria-disabled={!canDownloadPdf}
              onClick={(e) => !canDownloadPdf && e.preventDefault()} // Prevent click if disabled
            >
              View/Download PDF
            </a>
            
             {/* Segmentation Link (Conditional) */}
             {needsSegmentation && (
                  <Link 
                    href={`/jobs/${jobId}/segment`}
                    className="px-4 py-2 rounded font-medium text-white text-center bg-purple-600 hover:bg-purple-700"
                  >
                      Perform Segmentation
                  </Link>
             )}

            {/* TODO: Add Compile Button */} 

            {/* TODO: Add PDF Viewer Component */} 
          </div>
        </div>
      )}
    </main>
  );
} 