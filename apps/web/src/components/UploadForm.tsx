'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { FileUp, Upload, File, X, CheckCircle2 } from 'lucide-react'; // Import icons
import { cn } from '@/lib/utils'; // Import cn utility for conditional class names
import { API_BASE_URL } from '@/lib/utils';

interface UploadFormProps {
  onUploadSuccess: () => void;
}

export function UploadForm({ onUploadSuccess }: UploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Dropzone callback
  const onDrop = useCallback((acceptedFiles: File[]) => {
    // We only handle single file uploads for now
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      // Optional: Add file type validation here if needed
      if (file.type !== 'application/pdf') {
          toast.error('Invalid file type. Please upload a PDF.');
          setSelectedFile(null);
      } else {
          setSelectedFile(file);
          toast.info(`Selected file: ${file.name}`);
      }
    } else {
      // Handle cases where no file is accepted (e.g., wrong type if validator is strict)
      setSelectedFile(null);
    }
  }, []);

  // useDropzone hook setup
  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] }, // Accept only PDF files
    multiple: false, // Only allow single file selection
  });

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile) {
      toast.error("Please select or drop a PDF file first.");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Uploading PDF...');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/upload/pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed with status: ' + response.status }));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      toast.success('Upload successful!', { id: toastId });
      setSelectedFile(null);
      onUploadSuccess();

    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        toast.error(`Upload failed: ${errorMessage}`, { id: toastId });
        console.error('Upload error:', e);
    } finally {
        setIsUploading(false);
    }
  };

  // Clear selected file
  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
  };

  return (
    <Card className="w-full max-w-lg mx-auto mb-8 shadow-md card-hover">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <FileUp className="h-5 w-5 text-primary" />
          <CardTitle>Upload Handwritten PDF</CardTitle>
        </div>
        <CardDescription>Drag & drop a PDF file here, or click to select.</CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        {/* Dropzone Area */}
        <div
          {...getRootProps()}
          className={cn(
            "relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ease-in-out",
            "flex flex-col items-center justify-center gap-4",
            isDragActive ? "border-primary/70 bg-primary/5" : "border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/50",
            isDragAccept && "border-green-500/70 bg-green-500/5",
            isDragReject && "border-red-500/70 bg-red-500/5",
          )}
        >
          <input {...getInputProps()} />
          
          {isDragActive ? (
            <div className="animate-bounce bg-primary/10 p-4 rounded-full">
              <Upload className="h-10 w-10 text-primary" />
            </div>
          ) : (
            <div className="bg-primary/10 p-4 rounded-full">
              <Upload className="h-10 w-10 text-primary" />
            </div>
          )}
          
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isDragActive
                ? isDragAccept 
                  ? "Drop to upload the PDF"
                  : "This file type is not supported"
                : "Drag & drop your PDF here"}
            </p>
            <p className="text-xs text-muted-foreground">
              or click to browse files (PDF only)
            </p>
          </div>
        </div>
        
        {/* Selected File Info */}
        {selectedFile && (
          <div className="mt-4 p-3 border rounded-lg bg-muted/50 flex items-center justify-between animate-in fade-in-50 slide-in-from-bottom-5 duration-300">
            <div className="flex items-center gap-2 overflow-hidden">
              <File className="h-5 w-5 flex-shrink-0 text-primary" />
              <span className="text-sm font-medium truncate">{selectedFile.name}</span>
              <span className="text-xs text-muted-foreground">
                ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
            <button
              onClick={handleClearFile}
              className="p-1 rounded-full hover:bg-muted-foreground/10 transition-colors"
              aria-label="Remove file"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-2">
        <Button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="w-full gap-2 button-hover-effect"
        >
          {isUploading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>Upload PDF</span>
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 