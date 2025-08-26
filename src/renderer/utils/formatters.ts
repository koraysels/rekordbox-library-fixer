/**
 * Shared formatting utilities for track data
 * Centralizes common formatting logic to avoid duplication
 */

export const formatFileSize = (bytes: number | undefined): string => {
  if (!bytes) return 'N/A';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};

export const formatDuration = (seconds: number | undefined): string => {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatBitrate = (bitrate: number | undefined): string => {
  if (!bitrate) return 'N/A';
  return `${bitrate} kbps`;
};

export const formatRating = (rating: number | undefined): string => {
  return `${rating || 0}/5`;
};

export const formatDate = (date: Date | undefined): string => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString();
};