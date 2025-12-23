'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { FileUp, Upload, File, X, CheckCircle2, CloudUpload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/utils';

interface UploadFormProps {
  onUploadSuccess: () => void;
}

export function UploadForm({ onUploadSuccess }: UploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Dropzone callback
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.type !== 'application/pdf') {
          toast.error('Invalid file type. Please upload a PDF.');
          setSelectedFile(null);
      } else {
          setSelectedFile(file);
          toast.info(`Selected file: ${file.name}`);
      }
    } else {
      setSelectedFile(null);
    }
  }, []);

  // useDropzone hook setup
  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
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
    <Card className="w-full max-w-xl mx-auto mb-8 shadow-md card-hover border-0 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <FileUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Upload Handwritten PDF</CardTitle>
            <CardDescription className="text-sm">Drag and drop or click to select your document</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {/* Dropzone Area */}
        <div
          {...getRootProps()}
          className={cn(
            "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ease-out",
            "flex flex-col items-center justify-center gap-4",
            "hover:border-primary/50 hover:bg-primary/5",
            isDragActive && "border-primary/70 bg-primary/5 scale-[1.02]",
            isDragAccept && "border-green-500/70 bg-green-500/5",
            isDragReject && "border-destructive/70 bg-destructive/5",
            !isDragActive && "border-border bg-muted/30"
          )}
        >
          <input {...getInputProps()} />
          
          <div className={cn(
            "p-4 rounded-2xl transition-all duration-300",
            isDragActive ? "bg-primary/15 scale-110" : "bg-primary/10"
          )}>
            {isDragActive ? (
              <CloudUpload className="h-10 w-10 text-primary animate-bounce" />
            ) : (
              <Upload className="h-10 w-10 text-primary" />
            )}
          </div>
          
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">
              {isDragActive
                ? isDragAccept 
                  ? "Drop to upload the PDF"
                  : "This file type is not supported"
                : "Drag and drop your PDF here"}
            </p>
            <p className="text-xs text-muted-foreground">
              or click to browse files (PDF only, max 50MB)
            </p>
          </div>
        </div>
        
        {/* Selected File Info */}
        {selectedFile && (
          <div className="mt-4 p-3.5 border rounded-xl bg-muted/50 flex items-center justify-between animate-in fade-in-50 slide-in-from-bottom-3 duration-300">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <File className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-medium truncate block">{selectedFile.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            </div>
            <button
              onClick={handleClearFile}
              className="p-2 rounded-lg hover:bg-destructive/10 transition-colors group"
              aria-label="Remove file"
            >
              <X className="h-4 w-4 text-muted-foreground group-hover:text-destructive transition-colors" />
            </button>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-2">
        <Button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="w-full gap-2 h-11 text-base font-medium shadow-sm"
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
