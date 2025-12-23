'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { CheckCircleIcon, ListChecks, Send } from 'lucide-react';
import { SegmentationTaskItem } from '../hooks/useSegmentationData';

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
        <Card className="overflow-hidden h-full shadow-sm border-0 bg-card/80 backdrop-blur-sm">
            <CardHeader className="bg-muted/30 pb-3 border-b">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <ListChecks size={18} className="text-primary" />
                    Segmentation Tasks
                </CardTitle>
            </CardHeader>
            
            <CardContent className="p-0 flex flex-col h-[calc(100%-57px)]">
                <div className="p-4 flex-grow overflow-y-auto">
                    {tasks.length > 0 ? (
                        <ul className="space-y-2.5">
                            {tasks.map((task, index) => {
                                const isCompleted = completedTasks.has(task.placeholder);
                                const isActive = index === currentTaskIndex;
                                
                                return (
                                    <li 
                                        key={index} 
                                        className={`p-3 rounded-xl cursor-pointer transition-all duration-200 
                                            ${isActive 
                                                ? 'bg-primary/10 border-2 border-primary/30 shadow-sm' 
                                                : 'bg-muted/30 border-2 border-transparent hover:border-primary/20 hover:bg-primary/5'} 
                                            ${isCompleted && !isActive ? 'bg-green-50 border-green-200' : ''}`
                                        }
                                        onClick={() => onSelectTask(index)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-start gap-2.5">
                                                {isCompleted ? (
                                                    <CheckCircleIcon size={18} className="text-green-600 mt-0.5 flex-shrink-0" />
                                                ) : (
                                                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${ 
                                                        isActive 
                                                        ? 'border-primary bg-primary/20' 
                                                        : 'border-muted-foreground/30'
                                                    } mt-0.5`}>
                                                        {isActive && (
                                                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <span className={`font-medium text-sm ${ 
                                                        isActive 
                                                        ? 'text-primary' 
                                                        : isCompleted 
                                                        ? 'text-green-700'
                                                        : 'text-foreground'
                                                    }`}>
                                                        {task.placeholder}
                                                    </span>
                                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed break-words">
                                                        {task.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })} 
                        </ul>
                    ) : (
                        <p className="text-muted-foreground text-center py-8 text-sm">
                            No segmentation tasks found for this job.
                        </p>
                    )}
                </div>
                
                {/* Footer section */} 
                <div className="p-4 border-t border-border mt-auto bg-muted/20">
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Completion Progress</span>
                            <span className="text-xs font-semibold text-primary">{completionPercentage}%</span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${completionPercentage}%` }}
                            ></div>
                        </div>
                    </div>
                    
                    <Button 
                        onClick={onSave} 
                        disabled={isSaving} 
                        className="w-full gap-2 h-10 shadow-sm"
                    >
                        {isSaving ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Send size={16} />
                                Submit Segmentations
                            </>
                        )}
                    </Button>
                    
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                        {completedTasks.size} of {tasks.length} tasks completed
                    </p>
                </div>
            </CardContent> 
        </Card> 
    );
}
