'use client';

import React, { useMemo, CSSProperties } from 'react';
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

    // Render existing boxes as absolutely positioned divs
    const renderedBoxDivs = useMemo(() => {
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
                border: '2px solid oklch(0.50 0.12 195)',
                backgroundColor: 'oklch(0.50 0.12 195 / 0.1)',
                color: 'white',
                fontSize: '12px',
                zIndex: 5,
                cursor: 'pointer',
                borderRadius: '4px',
                transition: 'all 0.15s ease',
            };
            
            const textStyle: CSSProperties = {
                 position: 'absolute',
                 left: '4px',
                 top: '4px',
                 padding: '2px 6px',
                 backgroundColor: 'oklch(0.40 0.12 195)',
                 borderRadius: '4px',
                 pointerEvents: 'none',
                 fontSize: '11px',
                 fontWeight: 500,
            }

            return (
                <div 
                    key={`box-${box.label}-${i}`} 
                    style={boxStyle} 
                    onClick={(e) => {
                         e.stopPropagation();
                         onRemoveBox(i);
                    }}
                    title={`Click to remove ${box.label}`}
                    className="hover:border-red-500 hover:bg-red-500/10"
                 >
                    <span style={textStyle}>{box.label}</span>
                 </div>
            );
        });
    }, [boxesToRender, renderedImageSize, imageOffset, onRemoveBox]);


    return (
        <div 
            ref={containerRef}
            className="h-full w-full flex justify-center items-center overflow-hidden bg-muted/20 relative touch-none"
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
                            pointerEvents: 'none',
                            borderRadius: '8px',
                            boxShadow: '0 4px 20px -4px oklch(0.25 0.02 30 / 0.15)',
                        }}
                        draggable="false"
                        onDragStart={(e) => e.preventDefault()}
                    />
                    {renderedBoxDivs}
                    <div style={newBoxStyle} /> 
                </React.Fragment>
            ) : (
                 <div className="h-full flex flex-col justify-center items-center text-muted-foreground gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary"></div>
                    <p className="font-medium text-sm">Loading page image...</p>
                 </div>
            )}
        </div>
    );
}
