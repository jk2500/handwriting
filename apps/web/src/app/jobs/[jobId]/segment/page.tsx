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
    Loader2,
    Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Import hooks and components
import { useSegmentationData } from './hooks/useSegmentationData';
import { useImageLoader } from './hooks/useImageLoader';
import { useDrawing } from './hooks/useDrawing';
import { TaskList } from './components/TaskList';
import { AnnotationCanvas } from './components/AnnotationCanvas';
import { TaskInstructions } from './components/TaskInstructions';
import { EnhanceModal } from './components/EnhanceModal';

export default function SegmentationPage() {
    const params = useParams();
    const jobId = params.jobId as string;
    const router = useRouter();

    // --- State --- 
    const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
    const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Enhancement state
    const [enhanceModalOpen, setEnhanceModalOpen] = useState(false);
    const [enhancingLabel, setEnhancingLabel] = useState<string | null>(null);
    const [enhanceResult, setEnhanceResult] = useState<{
        label: string;
        originalUrl: string;
        enhancedUrl: string;
        enhancedS3Path: string;
        segmentationId: number | null;
    } | null>(null);

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
        updateBoundingBox,
    } = useSegmentationData({ jobId });

    const {
        imageObj,
        containerSize,
        renderedImageSize
    } = useImageLoader({ pageImages, currentPageIndex, containerRef });
    
    const imageOffset = useMemo(() => {
        if (!containerSize.width || !containerSize.height || !renderedImageSize.width || !renderedImageSize.height) {
            return { x: 0, y: 0 };
        }
        return {
            x: (containerSize.width - renderedImageSize.width) / 2,
            y: (containerSize.height - renderedImageSize.height) / 2
        };
    }, [containerSize, renderedImageSize]);

    const currentTask = useMemo(() => segmentationTasks?.[currentTaskIndex], [segmentationTasks, currentTaskIndex]);
    const currentPage = useMemo(() => pageImages?.[currentPageIndex], [pageImages, currentPageIndex]);
    
    const enhancedLabels = useMemo(() => {
        const labels = new Set<string>();
        boundingBoxes.forEach(box => {
            if (box.useEnhanced && box.enhancedS3Path) {
                labels.add(box.label);
            }
        });
        return labels;
    }, [boundingBoxes]);
    
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
    useEffect(() => {
        setCurrentTaskIndex(0);
    }, [segmentationTasks]);

    // --- Calculated Values --- 
    const completionPercentage = useMemo(() => (
        segmentationTasks.length > 0
            ? Math.round((completedTasks.size / segmentationTasks.length) * 100)
            : 0
    ), [completedTasks, segmentationTasks]);

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

    const handleRemoveBoxOnPage = (indexOnPage: number) => {
        const boxToRemove = currentBoxesToRender[indexOnPage];
        if (!boxToRemove) return;

        const originalIndex = boundingBoxes.findIndex(
            b => b.label === boxToRemove.label && 
                 b.pageNumber === boxToRemove.pageNumber &&
                 b.x === boxToRemove.x &&
                 b.y === boxToRemove.y &&
                 b.width === boxToRemove.width &&
                 b.height === boxToRemove.height
        );

        if (originalIndex !== -1) {
            removeBoundingBoxByIndex(originalIndex);
        } else {
            console.warn("Could not find original index for box to remove", boxToRemove);
            toast.error("Error removing box.");
        }
    };
    
    const saveSegmentations = async () => {
        setIsSaving(true);
        try {
            if (boundingBoxes.length > 0) {
                console.log("[page.tsx] Raw boundingBoxes state before map:", JSON.stringify(boundingBoxes, null, 2));
                
                const apiSegmentations = boundingBoxes.map(box => ({
                    pageNumber: box.pageNumber, 
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                    label: box.label,
                    enhanced_s3_path: box.enhancedS3Path || null,
                    use_enhanced: box.useEnhanced || false,
                }));
                console.log("Submitting segmentations:", apiSegmentations); 
                const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/segmentations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiSegmentations),
                });
                if (!response.ok) {
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
                toast.info("No segmentations to save.");
            }
            
            router.push(`/jobs`);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast.error(`Error saving segmentations: ${errorMessage}`);
            console.error("Save segmentations error details:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEnhance = async (label: string) => {
        setEnhancingLabel(label);
        setEnhanceModalOpen(true);
        setEnhanceResult(null);

        const box = boundingBoxes.find(b => b.label === label);
        if (!box) {
            toast.error('Bounding box not found for this label');
            setEnhanceModalOpen(false);
            setEnhancingLabel(null);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/enhance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    label,
                    page_number: box.pageNumber,
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Enhancement failed');
            }

            const result = await response.json();
            setEnhanceResult({
                label: result.label,
                originalUrl: result.original_url,
                enhancedUrl: result.enhanced_url,
                enhancedS3Path: result.enhanced_s3_path,
                segmentationId: result.segmentation_id,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast.error(`Enhancement failed: ${errorMessage}`);
        } finally {
            setEnhancingLabel(null);
        }
    };

    const handleSelectOriginal = async () => {
        if (!enhanceResult) return;
        
        try {
            if (enhanceResult.segmentationId) {
                const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/segmentations/${enhanceResult.segmentationId}/use-enhanced`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ use_enhanced: false }),
                });
                if (!response.ok) throw new Error('API error');
            }
            
            updateBoundingBox(enhanceResult.label, {
                enhancedS3Path: enhanceResult.enhancedS3Path,
                useEnhanced: false,
            });
            toast.success('Using original image');
        } catch {
            toast.error('Failed to update preference');
        }
        
        setEnhanceModalOpen(false);
        setEnhanceResult(null);
    };

    const handleSelectEnhanced = async () => {
        if (!enhanceResult) return;
        
        try {
            if (enhanceResult.segmentationId) {
                const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/segmentations/${enhanceResult.segmentationId}/use-enhanced`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ use_enhanced: true }),
                });
                if (!response.ok) throw new Error('API error');
            }
            
            updateBoundingBox(enhanceResult.label, {
                enhancedS3Path: enhanceResult.enhancedS3Path,
                useEnhanced: true,
            });
            toast.success('Using AI enhanced image');
        } catch {
            toast.error('Failed to update preference');
        }
        
        setEnhanceModalOpen(false);
        setEnhanceResult(null);
    };

    // --- Render --- 
    if (dataLoading) {
        return (
            <div className="container mx-auto px-4 py-8 flex justify-center items-center h-[80vh]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading segmentation data...</p>
                </div>
            </div>
        );
    }

    if (dataError) {
        return (
            <div className="container mx-auto px-4 py-8">
                 <Link href="/jobs" className="text-primary hover:text-primary/80 flex items-center gap-1 mb-4 transition-colors">
                    <ArrowLeftIcon size={16} />
                    <span>Back to Jobs</span>
                </Link>
                <div className="bg-destructive/5 border border-destructive/20 text-destructive rounded-xl p-4 my-6 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-medium">Error loading segmentation data</h3>
                        <p className="text-sm opacity-90">{dataError}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 page-animation">
            {/* Header */} 
            <div className="mb-8">
                <Link href="/jobs" className="text-primary hover:text-primary/80 flex items-center gap-1 mb-4 transition-colors">
                    <ArrowLeftIcon size={16} />
                    <span>Back to Jobs</span>
                </Link>
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <Layers className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight gradient-text">
                            Document Segmentation
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Job ID: {jobId.substring(0, 12)}...
                        </p>
                    </div>
                </div>
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
                        onEnhance={handleEnhance}
                        enhancingLabel={enhancingLabel}
                        enhancedLabels={enhancedLabels}
                    />
                </div>

                {/* Column 2: Image Viewer & Annotation Area */} 
                <div className="lg:col-span-3">
                    <Card className="overflow-hidden h-full shadow-sm border-0 bg-card/80 backdrop-blur-sm">
                        {/* Canvas Header */} 
                        <CardHeader className="bg-muted/30 pb-3 flex flex-row justify-between items-center space-y-0 border-b">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold">
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
                                    className="flex items-center gap-1"
                                >
                                    <ChevronLeftIcon size={16} />
                                    <span className="sr-only md:not-sr-only">Previous</span>
                                </Button>
                                <span className="text-sm text-muted-foreground px-2 font-medium">
                                    Page {pageImages.length > 0 ? currentPageIndex + 1 : 0} of {pageImages.length}
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={goToNextPage}
                                    disabled={currentPageIndex >= pageImages.length - 1 || pageImages.length <= 1}
                                    className="flex items-center gap-1"
                                >
                                    <span className="sr-only md:not-sr-only">Next</span>
                                    <ChevronRightIcon size={16} />
                                </Button>
                            </div>
                        </CardHeader>
                        
                        {/* Canvas Area */} 
                        <CardContent className="p-0">
                            <div className="bg-muted/20 flex-grow relative h-[60vh]" ref={containerRef}>
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
                            <div className="p-4 border-t border-border bg-card">
                                <TaskInstructions currentTask={currentTask} />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Enhancement Modal */}
            <EnhanceModal
                isOpen={enhanceModalOpen}
                onClose={() => {
                    setEnhanceModalOpen(false);
                    setEnhanceResult(null);
                }}
                label={enhanceResult?.label || enhancingLabel || ''}
                originalUrl={enhanceResult?.originalUrl || null}
                enhancedUrl={enhanceResult?.enhancedUrl || null}
                isLoading={enhancingLabel !== null && !enhanceResult}
                onSelectOriginal={handleSelectOriginal}
                onSelectEnhanced={handleSelectEnhanced}
            />
        </div>
    );
}
