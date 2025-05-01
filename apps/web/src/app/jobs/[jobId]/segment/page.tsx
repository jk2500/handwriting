'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Konva from 'konva';
import { API_BASE_URL } from '@/lib/utils';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  ArrowLeftIcon, 
  CheckCircleIcon, 
  TrashIcon,
  PenToolIcon,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Dynamically import react-konva components with ssr: false
const Stage = dynamic(() => import('react-konva').then((mod) => mod.Stage), { ssr: false });
const Layer = dynamic(() => import('react-konva').then((mod) => mod.Layer), { ssr: false });
const Rect = dynamic(() => import('react-konva').then((mod) => mod.Rect), { ssr: false });
const KonvaImage = dynamic(() => import('react-konva').then((mod) => mod.Image), { ssr: false });
const Text = dynamic(() => import('react-konva').then((mod) => mod.Text), { ssr: false });

// Define interfaces for API responses and data structures
interface PageImageInfo {
    page_number: number;
    image_url: string;
}

interface SegmentationTaskItem {
    placeholder: string;
    description: string;
}

interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    pageNumber: number;
}

export default function SegmentationPage() {
    const params = useParams();
    const router = useRouter();
    const jobId = params.jobId as string;

    // State variables
    const [pageImages, setPageImages] = useState<PageImageInfo[]>([]);
    const [segmentationTasks, setSegmentationTasks] = useState<SegmentationTaskItem[]>([]);
    const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
    const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
    const [boundingBoxes, setBoundingBoxes] = useState<BoundingBox[]>([]);
    const [isDrawing, setIsDrawing] = useState<boolean>(false);
    const [newBox, setNewBox] = useState<Partial<BoundingBox> | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
    const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
    const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage>(null);

    // Detect dark mode
    useEffect(() => {
        // Check if dark mode is enabled initially
        setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        // Listen for changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e: MediaQueryListEvent) => {
            setIsDarkMode(e.matches);
        };
        
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Initialize and fetch data
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

                setPageImages(pagesData.pages || []);
                setSegmentationTasks(tasksData.tasks || []);

                // Find existing segmentations (if any)
                const segRes = await fetch(`${API_BASE_URL}/jobs/${jobId}/segmentations`);
                if (segRes.ok) {
                    const segData = await segRes.json();
                    if (segData && Array.isArray(segData)) {
                        // Convert to our format
                        const existingBoxes = segData.map(seg => ({
                            x: seg.x,
                            y: seg.y,
                            width: seg.width,
                            height: seg.height,
                            label: seg.label,
                            pageNumber: seg.page_number
                        }));
                        setBoundingBoxes(existingBoxes);
                        
                        // Mark tasks as completed
                        const completed = new Set<string>();
                        existingBoxes.forEach(box => {
                            completed.add(box.label);
                        });
                        setCompletedTasks(completed);
                    }
                }
            } catch (e: any) {
                setError(`Failed to load segmentation data: ${e.message}`);
                console.error("Fetch error:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [jobId]);

    // Load the current page image
    useEffect(() => {
        if (pageImages.length === 0 || currentPageIndex >= pageImages.length) return;
        
        const img = new window.Image();
        img.src = pageImages[currentPageIndex].image_url;
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            setImageObj(img);
            
            // Adjust canvas size to maintain aspect ratio
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                const containerHeight = containerRef.current.clientHeight;
                const imgAspectRatio = img.width / img.height;
                const containerAspectRatio = containerWidth / containerHeight;
                
                let newWidth, newHeight;
                if (imgAspectRatio > containerAspectRatio) {
                    newWidth = containerWidth;
                    newHeight = containerWidth / imgAspectRatio;
                } else {
                    newHeight = containerHeight;
                    newWidth = containerHeight * imgAspectRatio;
                }
                
                setStageSize({
                    width: newWidth,
                    height: newHeight
                });
            }
        };
    }, [pageImages, currentPageIndex]);

    // Adjust stage size on window resize
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current && imageObj) {
                const containerWidth = containerRef.current.clientWidth;
                const containerHeight = containerRef.current.clientHeight;
                const imgAspectRatio = imageObj.width / imageObj.height;
                const containerAspectRatio = containerWidth / containerHeight;
                
                let newWidth, newHeight;
                if (imgAspectRatio > containerAspectRatio) {
                    newWidth = containerWidth;
                    newHeight = containerWidth / imgAspectRatio;
                } else {
                    newHeight = containerHeight;
                    newWidth = containerHeight * imgAspectRatio;
                }
                
                setStageSize({
                    width: newWidth,
                    height: newHeight
                });
            }
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [imageObj]);

    // Drawing handlers - with proper type handling
    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!segmentationTasks[currentTaskIndex]) return;
        
        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;
        
        setIsDrawing(true);
        const { x, y } = pos;
        setNewBox({
            x,
            y,
            width: 0,
            height: 0,
            label: segmentationTasks[currentTaskIndex].placeholder,
            pageNumber: pageImages[currentPageIndex].page_number
        });
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isDrawing || !newBox) return;
        
        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;
        
        const { x, y } = pos;
        setNewBox({
            ...newBox,
            width: x - (newBox.x || 0),
            height: y - (newBox.y || 0)
        });
    };

    const handleMouseUp = () => {
        if (!isDrawing || !newBox || 
            !newBox.x || !newBox.y || 
            !newBox.width || !newBox.height ||
            !newBox.label || newBox.pageNumber === undefined) return;
            
        // Normalize width and height (support negative drawing)
        let finalBox: BoundingBox = {
            x: newBox.x,
            y: newBox.y,
            width: newBox.width,
            height: newBox.height,
            label: newBox.label,
            pageNumber: newBox.pageNumber
        };
        
        if (finalBox.width < 0) {
            finalBox.x += finalBox.width;
            finalBox.width = Math.abs(finalBox.width);
        }
        
        if (finalBox.height < 0) {
            finalBox.y += finalBox.height;
            finalBox.height = Math.abs(finalBox.height);
        }
        
        // Only add if the box has meaningful dimensions
        if (finalBox.width > 5 && finalBox.height > 5) {
            // Convert coordinates to relative (0-1) values for API
            const stageWidth = stageRef.current?.width() || 1;
            const stageHeight = stageRef.current?.height() || 1;
            
            const normalizedBox: BoundingBox = {
                ...finalBox,
                x: finalBox.x / stageWidth,
                y: finalBox.y / stageHeight,
                width: finalBox.width / stageWidth,
                height: finalBox.height / stageHeight
            };
            
            setBoundingBoxes([...boundingBoxes, normalizedBox]);
            setCompletedTasks(prev => new Set(prev).add(normalizedBox.label));
            toast.success(`Added bounding box for ${normalizedBox.label}`);
            
            // Automatically move to next task if this was the first time completing the current task
            if (!completedTasks.has(normalizedBox.label) && 
                currentTaskIndex < segmentationTasks.length - 1) {
                setCurrentTaskIndex(currentTaskIndex + 1);
            }
        }
        
        setIsDrawing(false);
        setNewBox(null);
    };

    // Touch event handlers
    const handleTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
        if (!segmentationTasks[currentTaskIndex]) return;
        
        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;
        
        setIsDrawing(true);
        const { x, y } = pos;
        setNewBox({
            x,
            y,
            width: 0,
            height: 0,
            label: segmentationTasks[currentTaskIndex].placeholder,
            pageNumber: pageImages[currentPageIndex].page_number
        });
    };

    const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
        if (!isDrawing || !newBox) return;
        
        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;
        
        const { x, y } = pos;
        setNewBox({
            ...newBox,
            width: x - (newBox.x || 0),
            height: y - (newBox.y || 0)
        });
    };

    const handleTouchEnd = () => {
        handleMouseUp(); // Reuse the same logic for touch end
    };

    // Save segmentations to API
    const saveSegmentations = async () => {
        if (boundingBoxes.length === 0) {
            toast.error("No segmentations to save");
            return;
        }
        
        setIsSaving(true);
        
        try {
            // Convert our data format to the API format
            const apiSegmentations = boundingBoxes.map(box => ({
                pageNumber: box.pageNumber,
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                label: box.label
            }));
            
            const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/segmentations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(apiSegmentations),
            });
            
            if (!response.ok) {
                throw new Error(`Failed to save segmentations: ${response.statusText}`);
            }
            
            toast.success("Segmentations saved successfully");
            
            // Update job status to segmentation complete
            const statusResponse = await fetch(`${API_BASE_URL}/jobs/${jobId}/status/segmentation-complete`, {
                method: 'POST'
            });
            
            if (!statusResponse.ok) {
                throw new Error("Failed to update job status");
            }
            
            toast.success("Job marked as segmentation complete");
            
            // Trigger compilation
            const compileResponse = await fetch(`${API_BASE_URL}/jobs/${jobId}/compile`, {
                method: 'POST'
            });
            
            if (compileResponse.ok) {
                toast.success("Compilation process started");
                router.push(`/jobs`);
            } else {
                throw new Error("Failed to trigger compilation");
            }
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
            console.error("Save/compile error:", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Navigate between pages and tasks
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

    const removeBoundingBox = (index: number) => {
        const newBoxes = [...boundingBoxes];
        const removedBox = newBoxes.splice(index, 1)[0];
        setBoundingBoxes(newBoxes);
        
        // Check if there are other boxes with the same label
        const hasOtherBoxesWithSameLabel = newBoxes.some(box => box.label === removedBox.label);
        if (!hasOtherBoxesWithSameLabel) {
            setCompletedTasks(prev => {
                const newSet = new Set(prev);
                newSet.delete(removedBox.label);
                return newSet;
            });
        }
        
        toast.info(`Removed bounding box for ${removedBox.label}`);
    };

    // Get Konva colors based on theme
    const getKonvaColors = () => {
        if (isDarkMode) {
            return {
                boxFill: "rgba(99, 102, 241, 0.3)",
                boxStroke: "rgba(129, 140, 248, 0.9)",
                newBoxFill: "rgba(248, 113, 113, 0.3)",
                newBoxStroke: "rgba(248, 113, 113, 0.9)",
                textFill: "#ffffff",
                textBackground: "rgba(99, 102, 241, 0.8)"
            };
        } else {
            return {
                boxFill: "rgba(79, 70, 229, 0.2)",
                boxStroke: "rgba(79, 70, 229, 0.9)",
                newBoxFill: "rgba(239, 68, 68, 0.2)",
                newBoxStroke: "rgba(239, 68, 68, 0.9)",
                textFill: "#ffffff",
                textBackground: "rgba(79, 70, 229, 0.8)"
            };
        }
    };

    const konvaColors = getKonvaColors();

    // Render visual elements
    const renderBoxes = () => {
        // Show relative bounding boxes (0-1) scaled to current stage size
        return boundingBoxes
            .filter(box => box.pageNumber === pageImages[currentPageIndex]?.page_number)
            .map((box, i) => (
                <React.Fragment key={i}>
                    <Rect
                        x={box.x * stageSize.width}
                        y={box.y * stageSize.height}
                        width={box.width * stageSize.width}
                        height={box.height * stageSize.height}
                        fill={konvaColors.boxFill}
                        stroke={konvaColors.boxStroke}
                        strokeWidth={2}
                        onClick={() => removeBoundingBox(i)}
                        onTap={() => removeBoundingBox(i)}
                        perfectDrawEnabled={false}
                        cornerRadius={4}
                    />
                    <Text
                        x={(box.x + 0.01) * stageSize.width}
                        y={(box.y + 0.01) * stageSize.height}
                        text={box.label}
                        fontSize={14}
                        fill={konvaColors.textFill}
                        padding={3}
                        background={konvaColors.textBackground}
                        perfectDrawEnabled={false}
                        cornerRadius={2}
                    />
                </React.Fragment>
            ));
    };

    // Render active drawing box
    const renderNewBox = () => {
        if (!isDrawing || !newBox || !newBox.width || !newBox.height) return null;
        
        return (
            <Rect
                x={newBox.x}
                y={newBox.y}
                width={newBox.width}
                height={newBox.height}
                fill={konvaColors.newBoxFill}
                stroke={konvaColors.newBoxStroke}
                strokeWidth={2}
                perfectDrawEnabled={false}
                dash={[5, 5]}
                cornerRadius={4}
            />
        );
    };

    // Calculate completion percentage
    const completionPercentage = segmentationTasks.length > 0 
        ? Math.round((completedTasks.size / segmentationTasks.length) * 100) 
        : 0;

    return (
        <div className="container mx-auto px-4 py-8 page-animation">
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

            {loading && (
                <div className="flex justify-center items-center p-12">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                </div>
            )}
            
            {error && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg p-4 my-6 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-medium">Error loading segmentation data</h3>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}

            {!loading && !error && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Column 1: Task List */} 
                    <div className="lg:col-span-1">
                        <Card className="overflow-hidden h-full">
                            <CardHeader className="bg-muted/50 pb-3">
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircleIcon size={18} className="text-primary" />
                                    Segmentation Tasks
                                </CardTitle>
                            </CardHeader>
                            
                            <CardContent className="p-0">
                                <div className="p-4 max-h-[60vh] overflow-y-auto">
                                    {segmentationTasks.length > 0 ? (
                                        <ul className="space-y-3">
                                            {segmentationTasks.map((task, index) => {
                                                const isCompleted = completedTasks.has(task.placeholder);
                                                const isActive = index === currentTaskIndex;
                                                
                                                return (
                                                    <li 
                                                        key={index} 
                                                        className={`
                                                            p-3 rounded-lg cursor-pointer transition-all duration-200
                                                            ${isActive 
                                                                ? 'bg-primary/10 border border-primary/20 shadow-sm' 
                                                                : 'bg-card border border-border hover:border-primary/20 hover:bg-primary/5'
                                                            }
                                                            ${isCompleted ? 'border-green-200 dark:border-green-900' : ''}
                                                        `}
                                                        onClick={() => selectTask(index)}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex items-start gap-2">
                                                                {isCompleted ? (
                                                                    <CheckCircleIcon size={18} className="text-green-600 dark:text-green-500 mt-0.5" />
                                                                ) : (
                                                                    <div className={`w-4 h-4 rounded-full border ${
                                                                        isActive 
                                                                        ? 'border-primary bg-primary/10' 
                                                                        : 'border-muted-foreground/30'
                                                                    } mt-1`}></div>
                                                                )}
                                                                <div>
                                                                    <span className={`font-medium ${
                                                                        isActive 
                                                                        ? 'text-primary' 
                                                                        : 'text-foreground'
                                                                    }`}>
                                                                        {task.placeholder}
                                                                    </span>
                                                                    <p className="text-sm text-muted-foreground mt-1 leading-snug">{task.description}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    ) : (
                                        <p className="text-muted-foreground text-center py-4">No segmentation tasks found for this job.</p>
                                    )}
                                </div>
                                
                                <div className="p-4 border-t border-border">
                                    <div className="mb-3">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-medium text-muted-foreground">Completion</span>
                                            <span className="text-xs font-medium text-primary">{completionPercentage}%</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-primary rounded-full transition-all duration-500"
                                                style={{ width: `${completionPercentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    
                                    <Button 
                                        onClick={saveSegmentations} 
                                        disabled={boundingBoxes.length === 0 || isSaving}
                                        className="w-full button-hover-effect"
                                    >
                                        {isSaving ? 'Processing...' : 'Submit and Compile'}
                                    </Button>
                                    
                                    <p className="text-xs text-muted-foreground mt-2 text-center">
                                        {completedTasks.size} of {segmentationTasks.length} tasks completed
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Column 2: Image Viewer & Annotation Area */} 
                    <div className="lg:col-span-3">
                        <Card className="overflow-hidden h-full">
                            <CardHeader className="bg-muted/50 pb-3 flex flex-row justify-between items-center space-y-0">
                                <CardTitle className="flex items-center gap-2">
                                    <PenToolIcon size={18} className="text-primary" />
                                    Annotation Canvas
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={goToPrevPage}
                                        disabled={currentPageIndex === 0}
                                        className="flex items-center gap-1 button-hover-effect"
                                    >
                                        <ChevronLeftIcon size={16} />
                                        <span className="sr-only md:not-sr-only">Previous</span>
                                    </Button>
                                    <span className="text-sm text-muted-foreground px-1">
                                        Page {currentPageIndex + 1} of {pageImages.length}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={goToNextPage}
                                        disabled={currentPageIndex >= pageImages.length - 1}
                                        className="flex items-center gap-1 button-hover-effect"
                                    >
                                        <span className="sr-only md:not-sr-only">Next</span>
                                        <ChevronRightIcon size={16} />
                                    </Button>
                                </div>
                            </CardHeader>
                            
                            <CardContent className="p-0">
                                <div className="bg-muted/50 flex-grow relative h-[60vh]" ref={containerRef}>
                                    {pageImages.length > 0 && imageObj ? (
                                        <div className="h-full w-full flex justify-center items-center overflow-hidden">
                                            <Stage
                                                ref={stageRef}
                                                width={stageSize.width}
                                                height={stageSize.height}
                                                onMouseDown={handleMouseDown}
                                                onMouseMove={handleMouseMove}
                                                onMouseUp={handleMouseUp}
                                                onTouchStart={handleTouchStart}
                                                onTouchMove={handleTouchMove}
                                                onTouchEnd={handleTouchEnd}
                                            >
                                                <Layer>
                                                    <KonvaImage
                                                        image={imageObj}
                                                        width={stageSize.width}
                                                        height={stageSize.height}
                                                        perfectDrawEnabled={false}
                                                    />
                                                    {renderBoxes()}
                                                    {renderNewBox()}
                                                </Layer>
                                            </Stage>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col justify-center items-center text-muted-foreground">
                                            <div className="bg-muted p-3 rounded-full mb-3">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 13h5a2 2 0 012 2v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                                                </svg>
                                            </div>
                                            <p className="font-medium">No page images found</p>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="p-4 border-t border-border">
                                    <div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="bg-primary/10 p-2 rounded-md">
                                                <PenToolIcon size={20} className="text-primary" />
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-foreground">
                                                    {segmentationTasks[currentTaskIndex]?.placeholder || 'No task selected'}
                                                </h3>
                                                <p className="text-sm text-primary/90 mt-1">
                                                    {segmentationTasks[currentTaskIndex]?.description || ''}
                                                </p>
                                                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span className="bg-card px-2 py-1 rounded border border-border inline-flex items-center gap-1">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m-8 6h12" />
                                                        </svg>
                                                        Draw
                                                    </span>
                                                    <span className="bg-card px-2 py-1 rounded border border-border inline-flex items-center gap-1">
                                                        <TrashIcon size={12} />
                                                        Click to delete
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
} 