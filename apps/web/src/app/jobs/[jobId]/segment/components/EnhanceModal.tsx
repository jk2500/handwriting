'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckIcon, XIcon, Sparkles } from 'lucide-react';

interface EnhanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    label: string;
    originalUrl: string | null;
    enhancedUrl: string | null;
    isLoading: boolean;
    onSelectOriginal: () => void;
    onSelectEnhanced: () => void;
}

export function EnhanceModal({
    isOpen,
    onClose,
    label,
    originalUrl,
    enhancedUrl,
    isLoading,
    onSelectOriginal,
    onSelectEnhanced,
}: EnhanceModalProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            <Card className="relative z-10 w-full max-w-4xl mx-4 shadow-2xl">
                <CardHeader className="border-b">
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Enhance Image: {label}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <p className="text-muted-foreground">Generating enhanced version...</p>
                            <p className="text-xs text-muted-foreground">This may take 10-15 seconds</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h3 className="font-medium text-sm text-center">Original (Cropped)</h3>
                                <div className="border rounded-lg overflow-hidden bg-muted/20 aspect-square flex items-center justify-center">
                                    {originalUrl ? (
                                        <img 
                                            src={originalUrl} 
                                            alt="Original cropped" 
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    ) : (
                                        <p className="text-muted-foreground text-sm">No image</p>
                                    )}
                                </div>
                                <Button 
                                    variant="outline" 
                                    className="w-full gap-2"
                                    onClick={onSelectOriginal}
                                >
                                    <XIcon className="h-4 w-4" />
                                    Use Original
                                </Button>
                            </div>

                            <div className="space-y-3">
                                <h3 className="font-medium text-sm text-center flex items-center justify-center gap-1">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    AI Enhanced
                                </h3>
                                <div className="border rounded-lg overflow-hidden bg-muted/20 aspect-square flex items-center justify-center border-primary/30">
                                    {enhancedUrl ? (
                                        <img 
                                            src={enhancedUrl} 
                                            alt="AI enhanced" 
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    ) : (
                                        <p className="text-muted-foreground text-sm">Enhancement failed</p>
                                    )}
                                </div>
                                <Button 
                                    className="w-full gap-2"
                                    onClick={onSelectEnhanced}
                                    disabled={!enhancedUrl}
                                >
                                    <CheckIcon className="h-4 w-4" />
                                    Use Enhanced
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end mt-6 pt-4 border-t">
                        <Button variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
