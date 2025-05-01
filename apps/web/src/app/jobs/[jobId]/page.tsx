'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation'; // Use useParams for App Router
import { API_BASE_URL, formatDate, getButtonVisibility } from '@/lib/utils';
import { getStatusDisplayName, getStatusClass } from '@/lib/statusUtils';

interface JobStatusDetails {
  job_id: string;
  status: string;
  error_message: string | null;
  model_used: string | null;
}

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

  // Calculate button visibility using the job as input for our utility
  const getButtonStates = () => {
    if (!jobStatus) return {
      canDownloadInitialTex: false,
      canDownloadFinalTex: false,
      canDownloadPdf: false,
      canSegment: false,
      canCompile: false
    };
    
    // Create a job-like object that matches the utility's expected input
    const jobLike = {
      status: jobStatus.status,
      // other fields would be here but aren't used by getButtonVisibility
    };
    
    return getButtonVisibility(jobLike as any);
  };
  
  const {
    canDownloadInitialTex,
    canDownloadFinalTex,
    canDownloadPdf,
    canSegment,
    canCompile
  } = getButtonStates();

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
          <p className={`text-xl font-semibold mb-4 ${getStatusClass(jobStatus.status)}`}>
            {getStatusDisplayName(jobStatus.status)}
          </p>
          
          {/* Display model used if available */}
          {jobStatus.model_used && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-500">Model</h3>
              <p className="mt-1">{jobStatus.model_used}</p>
            </div>
          )}
          
          {jobStatus.error_message && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                  <strong className="font-bold">Error: </strong>
                  <span className="block sm:inline">{jobStatus.error_message}</span>
              </div>
          )}

          <h2 className="text-lg font-medium text-gray-900 mb-3">Actions</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Initial TeX Download - only show after initial processing */}
            {canDownloadInitialTex && (
              <a
                href={`${API_BASE_URL}/jobs/${jobId}/tex`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded font-medium text-white text-center bg-blue-600 hover:bg-blue-700"
              >
                Download Initial TeX
              </a>
            )}

            {/* Segmentation Link - only show when awaiting segmentation */}
            {canSegment && (
              <Link 
                href={`/jobs/${jobId}/segment`}
                className="px-4 py-2 rounded font-medium text-white text-center bg-purple-600 hover:bg-purple-700"
              >
                Perform Segmentation
              </Link>
            )}
            
            {/* Compile Button - only show after segmentation is complete */}
            {canCompile && (
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/compile`, {
                      method: 'POST',
                    });
                    if (!response.ok) {
                      throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    // Optionally refresh data or show success message
                    alert('Compilation started successfully!');
                  } catch (error) {
                    console.error('Compilation error:', error);
                    alert('Failed to start compilation');
                  }
                }}
                className="px-4 py-2 rounded font-medium text-white text-center bg-indigo-600 hover:bg-indigo-700"
              >
                Compile Document
              </button>
            )}

            {/* Final TeX Download - only show after compilation */}
            {canDownloadFinalTex && (
              <a
                href={`${API_BASE_URL}/jobs/${jobId}/final-tex`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded font-medium text-white text-center bg-blue-600 hover:bg-blue-700"
              >
                Download Final TeX
              </a>
            )}

            {/* PDF Download/View - only show after compilation */}
            {canDownloadPdf && (
              <a
                href={`${API_BASE_URL}/jobs/${jobId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded font-medium text-white text-center bg-green-600 hover:bg-green-700"
              >
                View/Download PDF
              </a>
            )}

            {/* TODO: Add PDF Viewer Component */} 
          </div>
        </div>
      )}
    </main>
  );
} 