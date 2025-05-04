/**
 * Format date string to a more readable format
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date string
 */
export const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Job status definitions
 */
export const JOB_STATUS = {
  PENDING: 'pending',
  UPLOADED: 'uploaded',
  SEGMENTED: 'segmented',
  COMPILING: 'compiling',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * Determine which action buttons should be visible for a job based on its status
 * @param {object} job - The job object
 * @returns {object} Object with boolean flags for button visibility
 */
export const getButtonVisibility = (job) => {
  if (!job) return {};
  
  const status = job.status;
  
  return {
    canDownloadPdf: status === JOB_STATUS.COMPLETED,
    canSegment: status === JOB_STATUS.PENDING || status === JOB_STATUS.UPLOADED,
    canCompile: status === JOB_STATUS.SEGMENTED,
    canViewTex: [
      JOB_STATUS.SEGMENTED,
      JOB_STATUS.COMPILING,
      JOB_STATUS.COMPLETED,
      JOB_STATUS.FAILED
    ].includes(status),
  };
};

/**
 * Job type definition for reference
 * @typedef {Object} Job
 * @property {string} id - Unique identifier
 * @property {string} status - Current status
 * @property {string} input_pdf_filename - Original uploaded filename
 * @property {string} created_at - Creation date ISO string
 * @property {string} model_used - ML model used for processing
 */ 