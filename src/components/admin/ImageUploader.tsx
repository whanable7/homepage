'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';

interface ImageUploaderProps {
  onUpload: (imageUrl: string, thumbnailUrl: string) => void;
  currentImage?: string;
}

export default function ImageUploader({ onUpload, currentImage }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('PNG, JPG, WebP 파일만 업로드 가능합니다');
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      setError('파일 크기는 30MB 이하여야 합니다');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    setProgress(0);

    try {
      // Step 1: Get Cloudinary upload signature
      setProgress(10);
      const sigResponse = await fetch(
        `/api/portfolio/upload?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`
      );

      if (!sigResponse.ok) {
        const errorData = await sigResponse.json();
        throw new Error(errorData.error || '업로드 준비 실패');
      }

      const { signature, timestamp, publicId, folder, cloudName, apiKey } = await sigResponse.json();

      // Step 2: Upload directly to Cloudinary
      setProgress(20);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp.toString());
      formData.append('signature', signature);
      formData.append('folder', folder);
      formData.append('public_id', publicId);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: formData }
      );

      if (!uploadResponse.ok) {
        throw new Error('이미지 업로드 실패');
      }

      const result = await uploadResponse.json();
      setProgress(90);

      const imageUrl = result.secure_url;
      // Generate thumbnail using Cloudinary transformation
      const thumbnailUrl = imageUrl.replace('/upload/', '/upload/c_fill,w_400,h_400/');

      setProgress(100);
      onUpload(imageUrl, thumbnailUrl);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : '업로드 실패');
      setPreview(currentImage || null);
    } finally {
      setUploading(false);
    }
  }, [currentImage, onUpload]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    setPreview(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative aspect-[4/3] bg-[var(--border)]">
          <Image
            src={preview}
            alt="Preview"
            fill
            className="object-contain"
          />
          {!uploading && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
              aria-label="이미지 삭제"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-3/4 bg-white/20 rounded-full h-2">
                <div
                  className="bg-white h-2 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`aspect-[4/3] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-[var(--border)] hover:border-[var(--text-secondary)]'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-[var(--text-secondary)] mb-3"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="text-[var(--text-secondary)] text-sm mb-1">
            이미지를 드래그하거나 클릭하여 업로드
          </p>
          <p className="text-[var(--text-secondary)] text-xs">
            PNG, JPG, JPEG, WebP (최대 30MB)
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg"
        onChange={handleChange}
        className="hidden"
      />

      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}
    </div>
  );
}
