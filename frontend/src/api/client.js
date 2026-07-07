import axios from "axios";

const BASE_URL = window.location.hostname === "localhost"
  ? "/api"
  : "https://researchevalplatform.onrender.com/api";

const client = axios.create({ baseURL: BASE_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("pe_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default client;