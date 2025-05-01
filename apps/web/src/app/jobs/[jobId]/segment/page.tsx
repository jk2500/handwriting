'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// TODO: Define interfaces for API responses
interface PageImageInfo {
    page_number: number;
    image_url: string;
}
interface SegmentationTaskItem {
    placeholder: string;
    description: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function SegmentationPage() {
    const params = useParams();
    const jobId = params.jobId as string;

    const [pageImages, setPageImages] = useState<PageImageInfo[]>([]);
    const [segmentationTasks, setSegmentationTasks] = useState<SegmentationTaskItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!jobId) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch page images and segmentation tasks in parallel
                const [pagesRes, tasksRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/jobs/${jobId}/pages`),
                    fetch(`${API_BASE_URL}/jobs/${jobId}/segmentation-tasks`)
                ]);

                if (!pagesRes.ok) {
                    throw new Error(`Failed to fetch page images: ${pagesRes.statusText}`);
                }
                if (!tasksRes.ok) {
                    throw new Error(`Failed to fetch segmentation tasks: ${tasksRes.statusText}`);
                }

                const pagesData = await pagesRes.json();
                const tasksData = await tasksRes.json();

                setPageImages(pagesData.pages || []); // Assuming response is { job_id: ..., pages: [...] }
                setSegmentationTasks(tasksData.tasks || []); // Assuming response is { job_id: ..., tasks: [...] }

            } catch (e: any) {
                setError(`Failed to load segmentation data: ${e.message}`);
                console.error("Fetch error:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [jobId]);

    // TODO: Implement Bounding Box Drawing UI
    // TODO: Implement Logic to iterate through tasks and save segmentations

    return (
        <main className="container mx-auto p-4 font-[family-name:var(--font-geist-sans)]">
            <Link href={`/jobs/${jobId}`} className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Job Details</Link>

            <h1 className="text-2xl font-bold mb-4">Perform Segmentation</h1>
            <p className="mb-4 text-sm text-gray-500">Job ID: {jobId}</p>

            {loading && <p>Loading segmentation data...</p>}
            {error && <p className="text-red-500">Error: {error}</p>}

            {!loading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Column 1: Task List */} 
                    <div className="md:col-span-1 border rounded-lg p-4 overflow-y-auto h-[70vh]">
                        <h2 className="text-lg font-semibold mb-3">Segmentation Tasks</h2>
                        {segmentationTasks.length > 0 ? (
                            <ul>
                                {segmentationTasks.map((task, index) => (
                                    <li key={index} className="mb-3 p-2 border rounded cursor-pointer hover:bg-gray-100">
                                        <strong className="text-purple-700">{task.placeholder}</strong>
                                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                                        {/* TODO: Add indicator for completion status */}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500">No segmentation tasks found for this job.</p>
                        )}
                    </div>

                    {/* Column 2: Image Viewer & Annotation Area */} 
                    <div className="md:col-span-2 border rounded-lg p-4 h-[70vh] flex flex-col">
                        <h2 className="text-lg font-semibold mb-3">Page Viewer / Annotation</h2>
                        {pageImages.length > 0 ? (
                             <div className="relative flex-grow bg-gray-100 overflow-hidden">
                                 {/* TODO: Implement image display logic (e.g., show first page initially) */}
                                 {/* TODO: Implement Bounding Box drawing library here */}
                                 <img 
                                    src={pageImages[0]?.image_url} 
                                    alt={`Page ${pageImages[0]?.page_number}`}
                                    className="object-contain w-full h-full" 
                                 />
                                 <p className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded">Page {pageImages[0]?.page_number}</p>
                            </div>
                        ) : (
                            <p className="text-gray-500">No page images found.</p>
                        )}
                        {/* TODO: Add controls for page navigation if multiple pages */}
                        {/* TODO: Add buttons to Save/Confirm segmentation for current task */} 
                    </div>
                </div>
            )}
        </main>
    );
} 