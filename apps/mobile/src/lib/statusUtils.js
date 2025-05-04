export const getStatusDisplayName = (status) => {
  if (!status) return 'UNKNOWN';
  return status.replace('_', ' ').toUpperCase();
};

export const getStatusIcon = (status) => {
  switch (status) {
    case 'completed': return 'check-circle';
    case 'processing': return 'progress-clock';
    case 'compiling': return 'cog';
    case 'segmented': return 'scissors-cutting';
    case 'uploaded': return 'file-upload';
    case 'pending': return 'clock-outline';
    case 'failed': return 'alert-circle';
    default: return 'help-circle';
  }
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return '#4CAF50'; // Green
    case 'processing': 
    case 'compiling': return '#2196F3'; // Blue
    case 'segmented': return '#9C27B0'; // Purple
    case 'uploaded': return '#00BCD4'; // Cyan
    case 'pending': return '#FF9800'; // Orange
    case 'failed': return '#F44336'; // Red
    default: return '#9E9E9E'; // Grey
  }
}; 