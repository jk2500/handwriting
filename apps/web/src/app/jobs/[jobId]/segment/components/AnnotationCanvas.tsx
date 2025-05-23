'use client';

import React, { useMemo, CSSProperties, useEffect } from 'react';
import { BoundingBox } from '../hooks/useSegmentationData';

// Type for the temporary box being drawn
interface DrawingBoxStyle extends CSSProperties {
    display?: string;
}

// Props for the component
interface AnnotationCanvasProps {
    containerRef: React.RefObject<HTMLDivElement>;
    containerSize: { width: number; height: number };
    renderedImageSize: { width: number; height: number };
    imageOffset: { x: number; y: number };
    imageObj: HTMLImageElement | null;
    boxesToRender: BoundingBox[];
    newBoxStyle: DrawingBoxStyle;
    drawingEventHandlers: {
        onMouseDown: React.MouseEventHandler<HTMLDivElement>;
        onMouseMove: React.MouseEventHandler<HTMLDivElement>;
        onMouseUp: React.MouseEventHandler<HTMLDivElement>;
        onMouseLeave: React.MouseEventHandler<HTMLDivElement>;
        onTouchStart: React.TouchEventHandler<HTMLDivElement>;
        onTouchMove: React.TouchEventHandler<HTMLDivElement>;
        onTouchEnd: React.TouchEventHandler<HTMLDivElement>;
    };
    onRemoveBox: (index: number) => void;
}

export function AnnotationCanvas({ 
    containerRef,
    containerSize,
    renderedImageSize,
    imageOffset,
    imageObj,
    boxesToRender,
    newBoxStyle,
    drawingEventHandlers,
    onRemoveBox
}: AnnotationCanvasProps) {
    // const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
    // const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

    // Render existing boxes as absolutely positioned divs
    const renderedBoxDivs = useMemo(() => {
        // Convert relative box coordinates (0-1) to image pixel coordinates
        return boxesToRender.map((box, i) => {
            const pixelX = box.x * renderedImageSize.width + imageOffset.x;
            const pixelY = box.y * renderedImageSize.height + imageOffset.y;
            const pixelWidth = box.width * renderedImageSize.width;
            const pixelHeight = box.height * renderedImageSize.height;

            const boxStyle: CSSProperties = {
                position: 'absolute',
                left: `${pixelX}px`,
                top: `${pixelY}px`,
                width: `${pixelWidth}px`,
                height: `${pixelHeight}px`,
                border: '2px solid blue', // Example style for saved boxes
                backgroundColor: 'rgba(0, 0, 255, 0.1)',
                color: 'white',
                fontSize: '12px',
                zIndex: 5, // Below drawing box
                cursor: 'pointer' // Indicate clickable for delete
            };
            
            const textStyle: CSSProperties = {
                 position: 'absolute',
                 left: '2px',
                 top: '2px',
                 padding: '1px 3px',
                 backgroundColor: 'rgba(0, 0, 150, 0.7)',
                 borderRadius: '2px',
                 pointerEvents: 'none' // Don't block clicks on the box
            }

            return (
                <div 
                    key={`box-${box.label}-${i}`} 
                    style={boxStyle} 
                    onClick={(e) => {
                         e.stopPropagation(); // Prevent triggering draw start on the container
                         onRemoveBox(i);
                    }}
                    title={`Click to remove ${box.label}`}
                 >
                    <span style={textStyle}>{box.label}</span>
                    {/* Optional: Add a small explicit delete button 
                    <button 
                         onClick={(e) => { e.stopPropagation(); onRemoveBox(i); }} 
                         style={{ position: 'absolute', right: 0, top: 0, background: 'red', border: 'none', color:'white', cursor:'pointer', padding:'0 2px' }}
                    >
                         <TrashIcon size={10}/>
                    </button>
                    */}
                 </div>
            );
        });
    }, [boxesToRender, renderedImageSize, imageOffset, onRemoveBox]);

    useEffect(() => {
        if (containerRef.current) {
            // const container = containerRef.current;
            const img = new window.Image();
            img.src = imageObj?.src || '';
            img.onload = () => {
                // setImageElement(img);
            };
        }
    }, [imageObj, containerRef]);

    useEffect(() => {
        if (containerRef.current) {
            // const container = containerRef.current;
            // setCanvasSize({ width: container.clientWidth, height: container.clientHeight });
        }
    }, [containerRef]);

    return (
        <div 
            ref={containerRef}
            className="h-full w-full flex justify-center items-center overflow-hidden bg-muted/30 relative touch-none"
            style={{ width: containerSize.width, height: containerSize.height }}
            {...drawingEventHandlers}
        >
            {imageObj ? (
                <React.Fragment>
                    <img 
                        src={imageObj.src}
                        alt="Document page" 
                        width={renderedImageSize.width}
                        height={renderedImageSize.height}
                        style={{
                            display: 'block',
                            objectFit: 'contain', 
                            position: 'absolute',
                            left: `${imageOffset.x}px`,
                            top: `${imageOffset.y}px`,
                            pointerEvents: 'none'
                        }}
                        draggable="false"
                        onDragStart={(e) => e.preventDefault()}
                    />
                    {renderedBoxDivs}
                    <div style={newBoxStyle} /> 
                </React.Fragment>
            ) : (
                 <div className="h-full flex flex-col justify-center items-center text-muted-foreground">
                    <p className="font-medium">Loading page image...</p>
                 </div>
            )}
        </div>
    );
} 