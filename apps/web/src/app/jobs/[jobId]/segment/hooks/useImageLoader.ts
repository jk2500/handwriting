'use client';

import { useState, useEffect, RefObject } from 'react';
import { PageImageInfo } from './useSegmentationData'; // Import shared type

interface UseImageLoaderProps {
    pageImages: PageImageInfo[];
    currentPageIndex: number;
    containerRef: RefObject<HTMLDivElement | null>;
}

export function useImageLoader({ 
    pageImages, 
    currentPageIndex, 
    containerRef 
}: UseImageLoaderProps) {
    
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
    // Store the actual rendered image dimensions within the container
    const [renderedImageSize, setRenderedImageSize] = useState({ width: 0, height: 0 });
    // Store scale factor: natural size / rendered size
    const [imageScale, setImageScale] = useState({ x: 1, y: 1 }); 

    // Calculate container size and rendered image size
    const calculateSizes = (container: HTMLDivElement | null, img: HTMLImageElement | null) => {
        if (!container || !img || !img.naturalWidth || !img.naturalHeight) {
            setContainerSize({ width: container?.clientWidth || 0, height: container?.clientHeight || 0 });
            setRenderedImageSize({ width: 0, height: 0 });
            setImageScale({ x: 1, y: 1 });
            return; 
        }

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        
        setContainerSize({ width: containerWidth, height: containerHeight });

        const imgAspectRatio = naturalWidth / naturalHeight;
        const containerAspectRatio = containerWidth / containerHeight;
        
        let renderWidth, renderHeight;
        if (imgAspectRatio > containerAspectRatio) {
            // Image is wider than container, constrained by width
            renderWidth = containerWidth;
            renderHeight = containerWidth / imgAspectRatio;
        } else {
            // Image is taller than container, constrained by height
            renderHeight = containerHeight;
            renderWidth = containerHeight * imgAspectRatio;
        }
        
        setRenderedImageSize({ width: renderWidth, height: renderHeight });

        // Calculate scale: how many natural pixels per rendered pixel
        setImageScale({
            x: naturalWidth / renderWidth,
            y: naturalHeight / renderHeight
        });
    };

    // Load the current page image
    useEffect(() => {
        setImageObj(null); // Clear previous image
        if (pageImages.length === 0 || currentPageIndex >= pageImages.length) return;
        
        const currentImageInfo = pageImages[currentPageIndex];
        if (!currentImageInfo?.image_url) return;

        const img = new window.Image();
        img.src = currentImageInfo.image_url;
        img.crossOrigin = 'anonymous'; // Still potentially useful if drawing to canvas later
        
        img.onload = () => {
            setImageObj(img); 
            // Calculate sizes *after* image is loaded and state is set
            calculateSizes(containerRef.current, img);
        };

        img.onerror = (error) => {
            console.error("Error loading image:", currentImageInfo.image_url, error);
            setImageObj(null);
            calculateSizes(containerRef.current, null); // Reset sizes on error
        };

    }, [pageImages, currentPageIndex, containerRef]); // Rerun when image or container changes

    // Adjust sizes on window resize
    useEffect(() => {
        const handleResize = () => {
            calculateSizes(containerRef.current, imageObj);
        };

        // Calculate initial size
        calculateSizes(containerRef.current, imageObj);

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [imageObj, containerRef]); // Rerun when imageObj or container changes

    return {
        imageObj,
        containerSize,
        renderedImageSize, // Size the image actually occupies on screen
        imageScale // Scale factor (natural / rendered)
    };
} 