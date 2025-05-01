'use client';

import React, { useState, useCallback, RefObject, useMemo } from 'react';
import { toast } from 'sonner';
import { BoundingBox, SegmentationTaskItem, PageImageInfo } from './useSegmentationData';

interface UseDrawingProps {
    containerRef: RefObject<HTMLDivElement | null>;
    containerSize: { width: number; height: number };
    renderedImageSize: { width: number; height: number }; // Actual image size on screen
    imageOffset: { x: number; y: number }; // Offset of image within container (if centered)
    currentTask: SegmentationTaskItem | undefined;
    currentPage: PageImageInfo | undefined;
    addBoundingBoxCallback: (box: BoundingBox) => void;
    goToNextTaskCallback?: () => void;
}

interface DrawingBox {
    startX: number; // Start position in pixels relative to container
    startY: number;
    endX: number; // Current end position in pixels relative to container
    endY: number;
    label: string;
    pageNumber: number;
}

export function useDrawing({ 
    containerRef, 
    containerSize, 
    renderedImageSize,
    imageOffset,
    currentTask, 
    currentPage, 
    addBoundingBoxCallback, 
    goToNextTaskCallback
}: UseDrawingProps) {
    const [isDrawing, setIsDrawing] = useState<boolean>(false);
    const [newBox, setNewBox] = useState<DrawingBox | null>(null);

    const getPointerPosition = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>): { x: number; y: number } | null => {
        if (!containerRef.current) return null;
        const rect = containerRef.current.getBoundingClientRect();
        
        let clientX, clientY;
        if ('touches' in e) {
            if (e.touches.length === 0) return null;
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const handleDrawStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        e.preventDefault(); 
        // Log the current page info when drawing starts
        console.log("[useDrawing] handleDrawStart - currentPage:", currentPage);
        if (!currentTask || !currentPage || currentPage.page_number === undefined) { // Check page_number too
            toast.warning("Please select a task and ensure page data is loaded before drawing.");
            console.error("[useDrawing] Draw start failed: Missing task or page info.", { currentTask, currentPage });
            return;
        }
        
        const pos = getPointerPosition(e);
        if (!pos) return;

        if (pos.x < imageOffset.x || pos.x > imageOffset.x + renderedImageSize.width || 
            pos.y < imageOffset.y || pos.y > imageOffset.y + renderedImageSize.height) {
             console.log("[useDrawing] Draw start outside image area.");
             return; 
        }
        
        console.log(`[useDrawing] Starting draw for task '${currentTask.placeholder}' on page ${currentPage.page_number}`);
        setIsDrawing(true);
        setNewBox({
            startX: pos.x,
            startY: pos.y,
            endX: pos.x,
            endY: pos.y,
            label: currentTask.placeholder,
            pageNumber: currentPage.page_number // Assign page number here
        });
    };

    const handleDrawMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (!isDrawing || !newBox) return;
        e.preventDefault(); 
        
        const pos = getPointerPosition(e);
        if (!pos) return;
        
        setNewBox({
            ...newBox,
            endX: pos.x,
            endY: pos.y
        });
    };

    const handleDrawEnd = (e?: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (!isDrawing || !newBox) return;
        if (e) e.preventDefault();

        // Calculate final box dimensions in pixels relative to container
        const startX = Math.min(newBox.startX, newBox.endX);
        const startY = Math.min(newBox.startY, newBox.endY);
        const endX = Math.max(newBox.startX, newBox.endX);
        const endY = Math.max(newBox.startY, newBox.endY);
        let width = endX - startX;
        let height = endY - startY;

        // Check if the newBox being processed actually has a page number
        console.log("[useDrawing] handleDrawEnd - processing newBox:", newBox);
        
        if (newBox.pageNumber === undefined) {
            console.error("[useDrawing] CRITICAL: pageNumber is missing from newBox state during handleDrawEnd!");
            toast.error("Internal error: Could not determine page number for the box.");
            setIsDrawing(false);
            setNewBox(null);
            return;
        }

        // Only add if the box has meaningful dimensions 
        if (width > 5 && height > 5) {
             // Convert pixel coordinates relative to *image* to relative (0-1) coordinates
             // Adjust for image offset within the container
             const relativeX = (startX - imageOffset.x) / renderedImageSize.width;
             const relativeY = (startY - imageOffset.y) / renderedImageSize.height;
             const relativeWidth = width / renderedImageSize.width;
             const relativeHeight = height / renderedImageSize.height;

             // Clamp coordinates to be within [0, 1] in case drawing went slightly outside
             const clampedX = Math.max(0, Math.min(1, relativeX));
             const clampedY = Math.max(0, Math.min(1, relativeY));
             const clampedWidth = Math.max(0, Math.min(1 - clampedX, relativeWidth));
             const clampedHeight = Math.max(0, Math.min(1 - clampedY, relativeHeight));

            if (clampedWidth > 0.01 && clampedHeight > 0.01) { // Check relative size
                const finalRelativeBox: BoundingBox = {
                    x: clampedX,
                    y: clampedY,
                    width: clampedWidth,
                    height: clampedHeight,
                    label: newBox.label,
                    pageNumber: newBox.pageNumber
                };
                
                // Log the final box object just before adding
                console.log("[useDrawing] handleDrawEnd - adding finalRelativeBox:", finalRelativeBox);
                
                addBoundingBoxCallback(finalRelativeBox);
                toast.success(`Added box for ${finalRelativeBox.label}`);
                goToNextTaskCallback?.();
            } else {
                 toast.info("Box too small after clamping, not added.");
            }
        } else {
            toast.info("Box too small, not added.");
        }
        
        setIsDrawing(false);
        setNewBox(null);
    };

    // Separate mouse/touch handlers for clarity
    const drawingEventHandlers = {
        onMouseDown: handleDrawStart,
        onMouseMove: handleDrawMove,
        onMouseUp: handleDrawEnd,
        onMouseLeave: handleDrawEnd, // End drawing if mouse leaves container
        onTouchStart: handleDrawStart,
        onTouchMove: handleDrawMove,
        onTouchEnd: handleDrawEnd,
    };

    // Calculate the style for the temporary drawing box div
    const newBoxStyle = useMemo(() => {
        if (!isDrawing || !newBox) return { display: 'none' };
        const x = Math.min(newBox.startX, newBox.endX);
        const y = Math.min(newBox.startY, newBox.endY);
        const width = Math.abs(newBox.endX - newBox.startX);
        const height = Math.abs(newBox.endY - newBox.startY);
        return {
            position: 'absolute' as const,
            left: `${x}px`,
            top: `${y}px`,
            width: `${width}px`,
            height: `${height}px`,
            border: '2px dashed red', // Example style
            backgroundColor: 'rgba(255, 0, 0, 0.2)',
            pointerEvents: 'none' as const, // Prevent interaction with the drawing box
            zIndex: 10, // Ensure it's above the image
        };
    }, [isDrawing, newBox]);

    return {
        isDrawing,
        drawingEventHandlers,
        newBoxStyle // Provide the style object for the temporary box div
    };
} 