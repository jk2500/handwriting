'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Konva from 'konva';
import { API_BASE_URL } from '@/lib/utils';

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

    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage>(null);

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

    // Drawing handlers
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
            
            if (statusResponse.ok) {
                toast.success("Job marked as segmentation complete");
                router.push(`/jobs`);
            }
        } catch (error: any) {
            toast.error(`Error saving segmentations: ${error.message}`);
            console.error("Save error:", error);
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
                        fill="rgba(0, 150, 255, 0.1)"
                        stroke="rgba(0, 150, 255, 0.8)"
                        strokeWidth={2}
                        onClick={() => removeBoundingBox(i)}
                        onTap={() => removeBoundingBox(i)}
                        perfectDrawEnabled={false}
                    />
                    <Text
                        x={(box.x + 0.01) * stageSize.width}
                        y={(box.y + 0.01) * stageSize.height}
                        text={box.label}
                        fontSize={14}
                        fill="#0066cc"
                        perfectDrawEnabled={false}
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
                fill="rgba(255, 0, 0, 0.1)"
                stroke="rgba(255, 0, 0, 0.8)"
                strokeWidth={2}
                perfectDrawEnabled={false}
            />
        );
    };

    return (
        <main className="container mx-auto p-4 font-[family-name:var(--font-geist-sans)]">
            <Link href="/jobs" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Jobs</Link>

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
                                    <li 
                                        key={index} 
                                        className={`mb-3 p-2 border rounded cursor-pointer transition-colors
                                            ${index === currentTaskIndex ? 'bg-purple-100 border-purple-300' : 'hover:bg-gray-100'}
                                            ${completedTasks.has(task.placeholder) ? 'border-green-300' : ''}`}
                                        onClick={() => selectTask(index)}
                                    >
                                        <div className="flex justify-between">
                                            <strong className="text-purple-700">{task.placeholder}</strong>
                                            {completedTasks.has(task.placeholder) && (
                                                <span className="text-green-600 text-sm">✓ Done</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500">No segmentation tasks found for this job.</p>
                        )}
                        
                        <div className="mt-6">
                            <Button 
                                onClick={saveSegmentations} 
                                disabled={boundingBoxes.length === 0 || isSaving}
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                            >
                                {isSaving ? 'Saving...' : 'Save All Segmentations'}
                            </Button>
                            
                            <p className="text-xs text-gray-500 mt-2">
                                {completedTasks.size} of {segmentationTasks.length} tasks completed
                            </p>
                        </div>
                    </div>

                    {/* Column 2: Image Viewer & Annotation Area */} 
                    <div className="md:col-span-2 border rounded-lg p-4 h-[70vh] flex flex-col">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-lg font-semibold">Page Viewer / Annotation</h2>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={goToPrevPage}
                                    disabled={currentPageIndex === 0}
                                >
                                    Previous Page
                                </Button>
                                <span>
                                    Page {currentPageIndex + 1} of {pageImages.length}
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={goToNextPage}
                                    disabled={currentPageIndex >= pageImages.length - 1}
                                >
                                    Next Page
                                </Button>
                            </div>
                        </div>
                        
                        <div className="flex-grow bg-gray-100 overflow-hidden" ref={containerRef}>
                            {pageImages.length > 0 && imageObj ? (
                                <div className="h-full w-full flex justify-center items-center">
                                    <Stage
                                        ref={stageRef}
                                        width={stageSize.width}
                                        height={stageSize.height}
                                        onMouseDown={handleMouseDown}
                                        onMouseMove={handleMouseMove}
                                        onMouseUp={handleMouseUp}
                                        onTouchStart={handleMouseDown}
                                        onTouchMove={handleMouseMove}
                                        onTouchEnd={handleMouseUp}
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
                                <p className="text-gray-500 flex justify-center items-center h-full">
                                    No page images found.
                                </p>
                            )}
                        </div>
                        
                        <div className="mt-4 bg-yellow-50 p-3 rounded-lg">
                            <p className="text-sm font-medium">
                                Drawing: {segmentationTasks[currentTaskIndex]?.placeholder || 'No task selected'}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                                {segmentationTasks[currentTaskIndex]?.description || ''}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                                Click and drag to draw a box. Click on a box to remove it.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
} 