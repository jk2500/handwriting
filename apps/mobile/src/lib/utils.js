export const API_BASE_URL = 'https://handwriting-3t94.onrender.com';

export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString();
};

/*
export const getButtonVisibility = (job) => ({
  canDownloadPdf: job.status === 'completed',
  canSegment: job.status === 'pending' || job.status === 'uploaded',
  canCompile: job.status === 'segmented',
});
*/ 