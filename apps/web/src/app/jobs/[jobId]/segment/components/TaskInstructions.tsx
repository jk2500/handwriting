'use client';

import React from 'react';
import { PenToolIcon, Trash2Icon, MousePointerClick } from 'lucide-react';
import { SegmentationTaskItem } from '../hooks/useSegmentationData';

interface TaskInstructionsProps {
    currentTask: SegmentationTaskItem | undefined;
}

export function TaskInstructions({ currentTask }: TaskInstructionsProps) {
    return (
        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
            <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2.5 rounded-xl flex-shrink-0">
                    <PenToolIcon size={20} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground">
                        {currentTask?.placeholder || 'No task selected'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 break-words leading-relaxed">
                        {currentTask?.description || 'Select a task from the list to begin annotation.'}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="bg-card px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium inline-flex items-center gap-1.5 text-muted-foreground">
                            <MousePointerClick size={12} />
                            Click & Drag to Draw
                        </span>
                        <span className="bg-card px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium inline-flex items-center gap-1.5 text-muted-foreground">
                            <Trash2Icon size={12} />
                            Click Box to Delete
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
