// src/api.js
// All resume API calls. Token is read from localStorage automatically.

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

function getToken() {
  return localStorage.getItem("rc_token");
}

async function request(path, options = {}) {
  const res  = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// List all resumes (metadata only — fast)
export const fetchResumes = () => request("/resumes");

// Load one full resume by id
export const fetchResume = (id) => request(`/resumes/${id}`);

// Create a brand-new resume
export const createResume = (payload) =>
  request("/resumes", { method: "POST", body: JSON.stringify(payload) });

// Overwrite an existing resume
export const saveResume = (id, payload) =>
  request(`/resumes/${id}`, { method: "PUT", body: JSON.stringify(payload) });

// Rename a resume
export const renameResume = (id, label) =>
  request(`/resumes/${id}/label`, { method: "PATCH", body: JSON.stringify({ label }) });

// Delete a resume
export const deleteResume = (id) =>
  request(`/resumes/${id}`, { method: "DELETE" });