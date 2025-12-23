'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/utils';
import { toast } from 'sonner';

// Define interfaces (consider moving to a shared types file if used elsewhere)
export interface PageImageInfo {
    page_number: number;
    image_url: string;
}

export interface SegmentationTaskItem {
    placeholder: string;
    description: string;
}

export interface BoundingBox {
    x: number; // Relative coordinate (0-1)
    y: number; // Relative coordinate (0-1)
    width: number; // Relative width (0-1)
    height: number; // Relative height (0-1)
    label: string;
    pageNumber: number;
    enhancedS3Path?: string;
    useEnhanced?: boolean;
}

// API response structure for segmentations (adjust if needed)
interface ApiSegmentation {
    id?: number;
    page_number: number;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    pageNumber: number;
    enhanced_s3_path?: string;
    use_enhanced?: boolean;
}

interface UseSegmentationDataProps {
    jobId: string | null;
}

export function useSegmentationData({ jobId }: UseSegmentationDataProps) {
    const [pageImages, setPageImages] = useState<PageImageInfo[]>([]);
    const [segmentationTasks, setSegmentationTasks] = useState<SegmentationTaskItem[]>([]);
    const [boundingBoxes, setBoundingBoxes] = useState<BoundingBox[]>([]);
    const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!jobId) return;

        setLoading(true);
        setError(null);
        try {
            // Fetch page images, segmentation tasks, and existing segmentations in parallel
            const [pagesRes, tasksRes, segRes] = await Promise.all([
                fetch(`${API_BASE_URL}/jobs/${jobId}/pages`),
                fetch(`${API_BASE_URL}/jobs/${jobId}/segmentation-tasks`),
                fetch(`${API_BASE_URL}/jobs/${jobId}/segmentations`), // Fetch existing segmentations
            ]).catch(networkError => {
                // Catch network errors for Promise.all
                throw new Error(`Network error during data fetch: ${networkError.message}`);
            });

            // Process pages response
            if (!pagesRes.ok) {
                const errorText = await pagesRes.text().catch(() => 'Failed to read error response');
                throw new Error(`Failed to fetch page images: ${pagesRes.status} ${pagesRes.statusText} - ${errorText}`);
            }
            const pagesData = await pagesRes.json();
            setPageImages(pagesData.pages || []);

            // Process tasks response
            if (!tasksRes.ok) {
                 const errorText = await tasksRes.text().catch(() => 'Failed to read error response');
                throw new Error(`Failed to fetch segmentation tasks: ${tasksRes.status} ${tasksRes.statusText} - ${errorText}`);
            }
            const tasksData = await tasksRes.json();
            setSegmentationTasks(tasksData.tasks || []);

            // Process existing segmentations response (optional, might be 404)
            if (segRes.ok) {
                const segData: ApiSegmentation[] = await segRes.json();
                
                // *** LOG RAW API RESPONSE ***
                console.log("[useSegmentationData] Raw response from /segmentations:", JSON.stringify(segData, null, 2));
                
                if (segData && Array.isArray(segData)) {
                    const existingBoxes = segData.map(seg => ({
                        x: seg.x,
                        y: seg.y,
                        width: seg.width,
                        height: seg.height,
                        label: seg.label,
                        pageNumber: seg.pageNumber,
                        enhancedS3Path: seg.enhanced_s3_path,
                        useEnhanced: seg.use_enhanced,
                    }));
                    
                    // *** LOG MAPPED BOXES ***
                    console.log("[useSegmentationData] Mapped existing boxes (check for pageNumber):", JSON.stringify(existingBoxes, null, 2));
                    
                    setBoundingBoxes(existingBoxes);

                    // Mark tasks as completed based on loaded segmentations
                    const completed = new Set<string>();
                    existingBoxes.forEach(box => completed.add(box.label));
                    setCompletedTasks(completed);
                    if (existingBoxes.length > 0) {
                         toast.info(`Loaded ${existingBoxes.length} existing segmentation(s).`);
                    }
                }
            } else if (segRes.status !== 404) {
                // Only throw error if it's not a 404 (meaning no segmentations saved yet)
                 const errorText = await segRes.text().catch(() => 'Failed to read error response');
                console.warn(`Could not fetch existing segmentations: ${segRes.status} ${segRes.statusText} - ${errorText}`);
                // Decide if this should be a user-facing error or just a warning
                // setError(`Warning: Could not fetch existing segmentations: ${segRes.statusText}`);
            }

        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            setError(`Failed to load segmentation data: ${errorMessage}`);
            console.error("Fetch error:", e);
            toast.error(`Error loading data: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]); // Depend on the memoized fetchData callback

    // Function to add a new bounding box
    const addBoundingBox = useCallback((newBox: BoundingBox) => {
        setBoundingBoxes(prevBoxes => [...prevBoxes, newBox]);
        setCompletedTasks(prev => new Set(prev).add(newBox.label));
    }, []);

    // Function to remove a bounding box by index
    const removeBoundingBoxByIndex = useCallback((indexToRemove: number) => {
        setBoundingBoxes(prevBoxes => {
            const boxToRemove = prevBoxes[indexToRemove];
            if (!boxToRemove) return prevBoxes; // Box not found

            const newBoxes = prevBoxes.filter((_, index) => index !== indexToRemove);
            
            // Recalculate completed tasks after removal
            const remainingLabels = new Set(newBoxes.map(box => box.label));
            setCompletedTasks(remainingLabels);

             toast.info(`Removed bounding box for ${boxToRemove.label}`);
            return newBoxes;
        });
    }, []);
    
    // Function to explicitly set boxes (e.g., when loading)
    const overwriteBoundingBoxes = useCallback((boxes: BoundingBox[]) => {
         setBoundingBoxes(boxes);
         const completed = new Set<string>();
         boxes.forEach(box => completed.add(box.label));
         setCompletedTasks(completed);
    }, []);

    // Function to update a bounding box by label
    const updateBoundingBox = useCallback((label: string, updates: Partial<BoundingBox>) => {
        setBoundingBoxes(prevBoxes => 
            prevBoxes.map(box => 
                box.label === label ? { ...box, ...updates } : box
            )
        );
    }, []);

    return {
        pageImages,
        segmentationTasks,
        boundingBoxes,
        completedTasks,
        loading,
        error,
        addBoundingBox,
        removeBoundingBoxByIndex,
        overwriteBoundingBoxes,
        updateBoundingBox,
        refetchData: fetchData // Expose refetch function
    };
} 