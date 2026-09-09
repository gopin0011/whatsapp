export const getAvatarUrl = (path?: string | null) => {
  if (!path) return null;
  if (path.startsWith('http')) return path; // Jika sudah URL lengkap
  const baseUrl = import.meta.env.VITE_API_CLIENT_URL || 'http://192.168.100.245:8082';
  return `${baseUrl}${path}`;
};