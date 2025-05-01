'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { CheckCircleIcon } from 'lucide-react';
import { SegmentationTaskItem } from '../hooks/useSegmentationData'; // Correct the import path for shared types

interface TaskListProps {
    tasks: SegmentationTaskItem[];
    currentTaskIndex: number;
    completedTasks: Set<string>;
    onSelectTask: (index: number) => void;
    completionPercentage: number;
    onSave: () => void;
    isSaving: boolean;
}

export function TaskList({ 
    tasks, 
    currentTaskIndex, 
    completedTasks, 
    onSelectTask, 
    completionPercentage, 
    onSave, 
    isSaving 
}: TaskListProps) {
    
    return (
        <Card className="overflow-hidden h-full">
            <CardHeader className="bg-muted/50 pb-3">
                <CardTitle className="flex items-center gap-2">
                    <CheckCircleIcon size={18} className="text-primary" />
                    Segmentation Tasks
                </CardTitle>
            </CardHeader>
            
            <CardContent className="p-0 flex flex-col h-[calc(100%-57px)]"> {/* Adjust height based on header */} 
                <div className="p-4 flex-grow overflow-y-auto"> {/* Allow content to scroll */} 
                    {tasks.length > 0 ? (
                        <ul className="space-y-3">
                            {tasks.map((task, index) => {
                                const isCompleted = completedTasks.has(task.placeholder);
                                const isActive = index === currentTaskIndex;
                                
                                return (
                                    <li 
                                        key={index} 
                                        className={ // Use regular JS object for cleaner conditional classes
                                            `p-3 rounded-lg cursor-pointer transition-all duration-200 
                                            ${isActive 
                                                ? 'bg-primary/10 border border-primary/20 shadow-sm' 
                                                : 'bg-card border border-border hover:border-primary/20 hover:bg-primary/5'} 
                                            ${isCompleted ? 'border-green-200 dark:border-green-900' : ''}`
                                        }
                                        onClick={() => onSelectTask(index)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-start gap-2">
                                                {isCompleted ? (
                                                    <CheckCircleIcon size={18} className="text-green-600 dark:text-green-500 mt-0.5 flex-shrink-0" />
                                                ) : (
                                                    <div className={`w-4 h-4 rounded-full border flex-shrink-0 ${ 
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
                                                    <p className="text-sm text-muted-foreground mt-1 leading-snug break-words">
                                                        {task.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </li> // Correct closing tag
                                );
                            })} 
                        </ul>
                    ) : (
                        <p className="text-muted-foreground text-center py-4">No segmentation tasks found for this job.</p>
                    )}
                </div>
                
                {/* Footer section */} 
                <div className="p-4 border-t border-border mt-auto"> {/* Stick to bottom */} 
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
                        onClick={onSave} 
                        // Only disable while saving, allow submit even if tasks.length is 0
                        disabled={isSaving} 
                        className="w-full button-hover-effect"
                    >
                        {isSaving ? 'Processing...' : 'Submit and Compile'}
                    </Button>
                    
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                        {completedTasks.size} of {tasks.length} tasks completed
                    </p>
                </div>
            </CardContent> 
        </Card> 
    );
} 