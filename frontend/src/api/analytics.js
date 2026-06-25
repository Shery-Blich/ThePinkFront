import api from './client.js';

export const getQuestionAnalytics = () => api.get('/analytics/questions').then((r) => r.data);
export const getSessionAnalytics = () => api.get('/analytics/sessions').then((r) => r.data);
