'use client';

import { useState, useEffect, useRef, RefObject } from 'react';
import { PageImageInfo } from './useSegmentationData';
import { getPreloadedImage } from '@/lib/utils';

interface UseImageLoaderProps {
    pageImages: PageImageInfo[];
    currentPageIndex: number;
    containerRef: RefObject<HTMLDivElement | null>;
}

const imageCache = new Map<string, HTMLImageElement>();

function preloadImage(url: string): void {
    if (!url || imageCache.has(url)) return;
    
    // Check if already preloaded by the global cache
    const globalCached = getPreloadedImage(url);
    if (globalCached) {
        imageCache.set(url, globalCached);
        return;
    }
    
    const img = new window.Image();
    img.src = url;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        imageCache.set(url, img);
    };
}

export function useImageLoader({ 
    pageImages, 
    currentPageIndex, 
    containerRef 
}: UseImageLoaderProps) {
    
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
    const [renderedImageSize, setRenderedImageSize] = useState({ width: 0, height: 0 });
    const [imageScale, setImageScale] = useState({ x: 1, y: 1 });
    const prefetchedRef = useRef<Set<number>>(new Set()); 

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

    useEffect(() => {
        setImageObj(null);
        if (pageImages.length === 0 || currentPageIndex >= pageImages.length) return;
        
        const currentImageInfo = pageImages[currentPageIndex];
        if (!currentImageInfo?.image_url) return;

        // Check local cache first
        const cachedImg = imageCache.get(currentImageInfo.image_url);
        if (cachedImg) {
            setImageObj(cachedImg);
            calculateSizes(containerRef.current, cachedImg);
            return;
        }
        
        // Check global preload cache
        const globalCached = getPreloadedImage(currentImageInfo.image_url);
        if (globalCached) {
            imageCache.set(currentImageInfo.image_url, globalCached);
            setImageObj(globalCached);
            calculateSizes(containerRef.current, globalCached);
            return;
        }

        const img = new window.Image();
        img.src = currentImageInfo.image_url;
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            imageCache.set(currentImageInfo.image_url, img);
            setImageObj(img);
            calculateSizes(containerRef.current, img);
        };

        img.onerror = (error) => {
            console.error("Error loading image:", currentImageInfo.image_url, error);
            setImageObj(null);
            calculateSizes(containerRef.current, null);
        };

    }, [pageImages, currentPageIndex, containerRef]);

    useEffect(() => {
        if (pageImages.length === 0) return;
        
        const pagesToPrefetch = [currentPageIndex - 1, currentPageIndex + 1, currentPageIndex + 2];
        pagesToPrefetch.forEach(idx => {
            if (idx >= 0 && idx < pageImages.length && !prefetchedRef.current.has(idx)) {
                const url = pageImages[idx]?.image_url;
                if (url) {
                    preloadImage(url);
                    prefetchedRef.current.add(idx);
                }
            }
        });
    }, [pageImages, currentPageIndex]);

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