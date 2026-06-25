import api from './client.js';

export const getQuestions = () => api.get('/questions').then((r) => r.data);
export const createQuestion = (data) => api.post('/questions', data).then((r) => r.data);
export const updateQuestion = (id, data) => api.put(`/questions/${id}`, data).then((r) => r.data);
export const deleteQuestion = (id) => api.delete(`/questions/${id}`).then((r) => r.data);
