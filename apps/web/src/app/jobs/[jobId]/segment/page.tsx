'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/utils';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ArrowLeftIcon,
    PenToolIcon,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Import hooks and components
import { useSegmentationData } from './hooks/useSegmentationData';
import { useImageLoader } from './hooks/useImageLoader';
import { useDrawing } from './hooks/useDrawing';
import { TaskList } from './components/TaskList';
import { AnnotationCanvas } from './components/AnnotationCanvas';
import { TaskInstructions } from './components/TaskInstructions';

export default function SegmentationPage() {
    const params = useParams();
    const router = useRouter();
    const jobId = params.jobId as string;

    // --- State --- 
    const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
    const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null); // Ref for canvas container

    // --- Custom Hooks --- 
    const {
        pageImages,
        segmentationTasks,
        boundingBoxes,
        completedTasks,
        loading: dataLoading,
        error: dataError,
        addBoundingBox,
        removeBoundingBoxByIndex,
    } = useSegmentationData({ jobId });

    const {
        imageObj,
        containerSize,
        renderedImageSize
    } = useImageLoader({ pageImages, currentPageIndex, containerRef });
    
    // Calculate image offset within the container (assuming centered)
    const imageOffset = useMemo(() => {
        if (!containerSize.width || !containerSize.height || !renderedImageSize.width || !renderedImageSize.height) {
            return { x: 0, y: 0 };
        }
        // Calculate offset needed to center the rendered image in the container
        return {
            x: (containerSize.width - renderedImageSize.width) / 2,
            y: (containerSize.height - renderedImageSize.height) / 2
        };
    }, [containerSize, renderedImageSize]);

    const currentTask = useMemo(() => segmentationTasks?.[currentTaskIndex], [segmentationTasks, currentTaskIndex]);
    const currentPage = useMemo(() => pageImages?.[currentPageIndex], [pageImages, currentPageIndex]);
    
    const handleGoToNextTask = useCallback(() => {
        if (currentTask && !completedTasks.has(currentTask.placeholder) && currentTaskIndex < segmentationTasks.length - 1) {
            setCurrentTaskIndex(prevIndex => prevIndex + 1);
        }
    }, [currentTask, completedTasks, currentTaskIndex, segmentationTasks.length]);

    const {
        newBoxStyle,
        drawingEventHandlers
    } = useDrawing({ 
        containerRef,
        renderedImageSize, 
        imageOffset,
        currentTask, 
        currentPage, 
        addBoundingBoxCallback: addBoundingBox,
        goToNextTaskCallback: handleGoToNextTask
    });

    // --- Effects --- 
    // Reset task index if tasks change
    useEffect(() => {
        setCurrentTaskIndex(0);
    }, [segmentationTasks]);

    // --- Calculated Values --- 
    const completionPercentage = useMemo(() => (
        segmentationTasks.length > 0
            ? Math.round((completedTasks.size / segmentationTasks.length) * 100)
            : 0
    ), [completedTasks, segmentationTasks]);

    // Filter boxes for the current page
    const currentBoxesToRender = useMemo(() => 
        boundingBoxes.filter(box => box.pageNumber === currentPage?.page_number)
    , [boundingBoxes, currentPage]);

    // --- Event Handlers --- 
    const goToNextPage = () => {
        if (currentPageIndex < pageImages.length - 1) {
            setCurrentPageIndex(currentPageIndex + 1);
        }
    };

    const goToPrevPage = () => {
        if (currentPageIndex > 0) {
            setCurrentPageIndex(currentPageIndex - 1);
        }
    };

    const selectTask = (index: number) => {
        setCurrentTaskIndex(index);
    };

    // Handles removing a box based on its index *within the filtered list for the current page*
    const handleRemoveBoxOnPage = (indexOnPage: number) => {
        // Find the actual box data corresponding to the index on the current page
        const boxToRemove = currentBoxesToRender[indexOnPage];
        if (!boxToRemove) return;

        // Find the index of this box in the *original* full boundingBoxes array
        const originalIndex = boundingBoxes.findIndex(
            b => b.label === boxToRemove.label && 
                 b.pageNumber === boxToRemove.pageNumber &&
                 b.x === boxToRemove.x && // Use coords for better matching if labels repeat
                 b.y === boxToRemove.y &&
                 b.width === boxToRemove.width &&
                 b.height === boxToRemove.height
                 // Potentially add a unique ID if available from API
        );

        if (originalIndex !== -1) {
            removeBoundingBoxByIndex(originalIndex); // Call hook with the correct original index
        } else {
            console.warn("Could not find original index for box to remove", boxToRemove);
            toast.error("Error removing box.");
        }
    };
    
    // Save segmentations to API only
    const saveSegmentations = async () => {
        setIsSaving(true);
        try {
            if (boundingBoxes.length > 0) {
                
                // *** Add log to inspect state directly ***
                console.log("[page.tsx] Raw boundingBoxes state before map:", JSON.stringify(boundingBoxes, null, 2));
                
                const apiSegmentations = boundingBoxes.map(box => ({
                    pageNumber: box.pageNumber, 
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                    label: box.label
                }));
                console.log("Submitting segmentations:", apiSegmentations); 
                const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/segmentations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiSegmentations),
                });
                if (!response.ok) {
                     // Improved error logging
                     let errorBody = "Could not read error response.";
                     try {
                         errorBody = await response.json(); 
                     } catch {
                         try { errorBody = await response.text(); } catch { /* Ignore */ }
                     }
                     console.error("Segmentation save error response:", errorBody);
                    throw new Error(`Failed to save segmentations: ${response.status} ${response.statusText}`);
                }
                toast.success("Segmentations saved successfully.");
            } else {
                // If no boxes, still show a success message or just do nothing?
                toast.info("No segmentations to save.");
            }
            
            // Trigger compilation process
            const compileResponse = await fetch(`${API_BASE_URL}/jobs/${jobId}/compile`, {
                method: 'POST'
            });
            if (!compileResponse.ok) {
                const errorText = await compileResponse.text().catch(() => 'Failed to read error response');
                throw new Error(`Failed to trigger compilation: ${compileResponse.status} ${errorText}`);
            }
            toast.success("Compilation process started.");
            // Uncomment the next line if you want to redirect after submission
            // router.push(`/jobs`);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast.error(`Error saving segmentations: ${errorMessage}`);
            console.error("Save segmentations error details:", error);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Render --- 
    if (dataLoading) {
        return (
            <div className="container mx-auto px-4 py-8 flex justify-center items-center h-[80vh]">
                 <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (dataError) {
        return (
            <div className="container mx-auto px-4 py-8">
                 <Link href="/jobs" className="text-primary hover:text-primary/80 flex items-center gap-1 mb-4">
                    <ArrowLeftIcon size={16} />
                    <span>Back to Jobs</span>
                </Link>
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg p-4 my-6 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-medium">Error loading segmentation data</h3>
                        <p className="text-sm">{dataError}</p>
                        {/* Optional: Add a retry button? */}
                        {/* <Button variant="destructive" size="sm" onClick={refetchData} className="mt-2">Retry</Button> */}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 page-animation">
            {/* Header */} 
            <div className="mb-8">
                <Link href="/jobs" className="text-primary hover:text-primary/80 flex items-center gap-1 mb-4">
                    <ArrowLeftIcon size={16} />
                    <span>Back to Jobs</span>
                </Link>
                <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    Document Segmentation
                </h1>
                <p className="text-muted-foreground">
                    Job ID: {jobId}
                </p>
            </div>

            {/* Main Content Grid */} 
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Column 1: Task List */} 
                <div className="lg:col-span-1">
                    <TaskList
                        tasks={segmentationTasks}
                        currentTaskIndex={currentTaskIndex}
                        completedTasks={completedTasks}
                        onSelectTask={selectTask}
                        completionPercentage={completionPercentage}
                        onSave={saveSegmentations}
                        isSaving={isSaving}
                    />
                </div>

                {/* Column 2: Image Viewer & Annotation Area */} 
                <div className="lg:col-span-3">
                    <Card className="overflow-hidden h-full">
                        {/* Canvas Header */} 
                        <CardHeader className="bg-muted/50 pb-3 flex flex-row justify-between items-center space-y-0">
                            <CardTitle className="flex items-center gap-2">
                                <PenToolIcon size={18} className="text-primary" />
                                Annotation Area
                            </CardTitle>
                            {/* Page Navigation */} 
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={goToPrevPage}
                                    disabled={currentPageIndex === 0 || pageImages.length <= 1}
                                    className="flex items-center gap-1 button-hover-effect"
                                >
                                    <ChevronLeftIcon size={16} />
                                    <span className="sr-only md:not-sr-only">Previous</span>
                                </Button>
                                <span className="text-sm text-muted-foreground px-1">
                                    Page {pageImages.length > 0 ? currentPageIndex + 1 : 0} of {pageImages.length}
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={goToNextPage}
                                    disabled={currentPageIndex >= pageImages.length - 1 || pageImages.length <= 1}
                                    className="flex items-center gap-1 button-hover-effect"
                                >
                                    <span className="sr-only md:not-sr-only">Next</span>
                                    <ChevronRightIcon size={16} />
                                </Button>
                            </div>
                        </CardHeader>
                        
                        {/* Canvas Area */} 
                        <CardContent className="p-0">
                            <div className="bg-muted/50 flex-grow relative h-[60vh]" ref={containerRef}>
                                <AnnotationCanvas
                                    containerRef={containerRef}
                                    containerSize={containerSize}
                                    renderedImageSize={renderedImageSize}
                                    imageOffset={imageOffset}
                                    imageObj={imageObj}
                                    boxesToRender={currentBoxesToRender}
                                    newBoxStyle={newBoxStyle}
                                    drawingEventHandlers={drawingEventHandlers}
                                    onRemoveBox={handleRemoveBoxOnPage}
                                />
                            </div>
                            
                            {/* Task Instructions Footer */} 
                            <div className="p-4 border-t border-border">
                                <TaskInstructions currentTask={currentTask} />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
} 

// Helper CSS class (if needed, otherwise remove or place in global CSS)
// Add this to your global CSS or a relevant CSS module if you want the animation:
/*
@keyframes page-fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
.page-animation {
    animation: page-fade-in 0.5s ease-out forwards;
}
*/ 