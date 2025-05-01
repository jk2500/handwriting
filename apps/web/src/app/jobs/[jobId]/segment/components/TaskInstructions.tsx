'use client';

import React from 'react';
import { PenToolIcon, TrashIcon } from 'lucide-react';
import { SegmentationTaskItem } from '../hooks/useSegmentationData'; // Import shared type

interface TaskInstructionsProps {
    currentTask: SegmentationTaskItem | undefined;
}

export function TaskInstructions({ currentTask }: TaskInstructionsProps) {
    return (
        <div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
            <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-md flex-shrink-0">
                    <PenToolIcon size={20} className="text-primary" />
                </div>
                <div>
                    <h3 className="font-medium text-foreground">
                        {currentTask?.placeholder || 'No task selected'}
                    </h3>
                    <p className="text-sm text-primary/90 mt-1 break-words">
                        {currentTask?.description || 'Select a task from the list to begin.'}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="bg-card px-2 py-1 rounded border border-border inline-flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m-8 6h12" />
                            </svg>
                            Draw Box
                        </span>
                        <span className="bg-card px-2 py-1 rounded border border-border inline-flex items-center gap-1">
                            <TrashIcon size={12} />
                            Click Box to Delete
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
} 