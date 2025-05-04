import { JOB_STATUS } from './utils';

/**
 * Get a display-friendly name for a job status
 * @param {string} status - The job status
 * @returns {string} Display name for the status
 */
export const getStatusDisplayName = (status) => {
  switch (status) {
    case JOB_STATUS.PENDING:
      return 'Pending';
    case JOB_STATUS.UPLOADED:
      return 'Uploaded';
    case JOB_STATUS.SEGMENTED:
      return 'Segmented';
    case JOB_STATUS.COMPILING:
      return 'Compiling';
    case JOB_STATUS.COMPLETED:
      return 'Completed';
    case JOB_STATUS.FAILED:
      return 'Failed';
    default:
      return status?.replace('_', ' ').toUpperCase() || 'Unknown';
  }
};

/**
 * Get the icon name to use for a given status
 * Using MaterialCommunityIcons names compatible with react-native-paper
 * @param {string} status - The job status
 * @returns {string} Icon name
 */
export const getStatusIcon = (status) => {
  switch (status) {
    case JOB_STATUS.PENDING:
      return 'clock-outline';
    case JOB_STATUS.UPLOADED:
      return 'file-upload-outline';
    case JOB_STATUS.SEGMENTED:
      return 'content-cut';
    case JOB_STATUS.COMPILING:
      return 'cog-sync';
    case JOB_STATUS.COMPLETED:
      return 'check-circle-outline';
    case JOB_STATUS.FAILED:
      return 'alert-circle-outline';
    default:
      return 'help-circle-outline';
  }
};

/**
 * Get the color to use for a given status
 * @param {string} status - The job status
 * @returns {string} Color name
 */
export const getStatusColor = (status) => {
  switch (status) {
    case JOB_STATUS.COMPLETED:
      return 'green';
    case JOB_STATUS.FAILED:
      return 'red';
    case JOB_STATUS.COMPILING:
      return 'orange';
    case JOB_STATUS.SEGMENTED:
      return 'blue';
    default:
      return 'gray';
  }
}; 