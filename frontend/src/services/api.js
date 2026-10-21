import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ---------- Lookups ----------
export const getCategories = async () => {
  const { data } = await api.get('/api/categories');
  return data.categories;
};

export const getCompanies = async () => {
  const { data } = await api.get('/api/companies');
  return data;
};

export const getCompanyCategories = async (companyId) => {
  const { data } = await api.get(`/api/companies/${companyId}/categories`);
  return data;
};

export const createNature = async (companyId, name, paymentType) => {
  const { data } = await api.post(`/api/companies/${companyId}/categories`, {
    name,
    payment_type: paymentType,
  });
  return data;
};

export const getPayees = async () => {
  const { data } = await api.get('/api/payees');
  return data;
};

export const createPayee = async (name) => {
  const { data } = await api.post('/api/payees', { name });
  return data;
};

// ---------- Documents ----------
export const uploadDocument = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/api/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const createManualDocument = async () => {
  const { data } = await api.post('/api/documents/manual');
  return data;
};

export const listDocuments = async () => {
  const { data } = await api.get('/api/documents');
  return data;
};

export const getDocumentStatus = async (docId) => {
  const { data } = await api.get(`/api/documents/${docId}/status`);
  return data;
};

export const getExtractedData = async (docId) => {
  const { data } = await api.get(`/api/documents/${docId}/extracted`);
  return data;
};

export const getSuggestions = async (docId) => {
  const { data } = await api.get(`/api/documents/${docId}/suggestions`);
  return data;
};

export const saveReview = async (docId, payload) => {
  const { data } = await api.post(`/api/documents/${docId}/review`, payload);
  return data;
};

export const reprocessDocument = async (docId) => {
  const { data } = await api.post(`/api/documents/${docId}/reprocess`);
  return data;
};

// ---------- Dashboard ----------
export const getDashboardStats = async () => {
  const { data } = await api.get('/api/dashboard/stats');
  return data;
};

// ---------- Requisitions ----------
export const listRequisitions = async (params = {}) => {
  const { data } = await api.get('/api/requisitions', { params });
  return data;
};

export const getFolderView = async (params = {}) => {
  const { data } = await api.get('/api/requisitions/folders', { params });
  return data;
};

export const getRequisition = async (id) => {
  const { data } = await api.get(`/api/requisitions/${id}`);
  return data;
};

export const updateRequisition = async (id, payload) => {
  const { data } = await api.put(`/api/requisitions/${id}`, payload);
  return data;
};

export const deleteRequisition = async (id) => {
  const { data } = await api.delete(`/api/requisitions/${id}`);
  return data;
};

// ---------- Annual Reports (Excel) ----------
export const downloadCompanyAnnualReport = (companyId, year) => {
  const url = `${API_URL}/api/companies/${companyId}/annual-report?year=${year}`;
  window.open(url, '_blank');
};

export const downloadAllCompaniesAnnualReport = (year) => {
  const url = `${API_URL}/api/dashboard/annual-report?year=${year}`;
  window.open(url, '_blank');
};

// ---------- Shared base URL ----------
export const API_BASE_URL = API_URL;

export const uploadIncomeReport = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/api/incomes/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const createIncome = async (payload) => {
  const { data } = await api.post('/api/incomes', payload);
  return data;
};

export const listIncomes = async (params = {}) => {
  const { data } = await api.get('/api/incomes', { params });
  return data;
};

export const getIncomeStats = async (year) => {
  const { data } = await api.get('/api/dashboard/income-stats', { params: { year } });
  return data;
};

export const downloadMonthlyReport = (year) => {
  window.open(`${API_URL}/api/dashboard/monthly-report?year=${year}`, '_blank');
};

export const createCompany = async (name, shortName) => {
  const { data } = await api.post('/api/companies', { name, short_name: shortName });
  return data;
};

export const getIncome = async (id) => {
  const { data } = await api.get(`/api/incomes/${id}`);
  return data;
};

export const updateIncome = async (id, payload) => {
  const { data } = await api.put(`/api/incomes/${id}`, payload);
  return data;
};

export const deleteIncome = async (id) => {
  const { data } = await api.delete(`/api/incomes/${id}`);
  return data;
};

export default api;