const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.message || "Something went wrong");
    error.status = res.status;
    error.details = data.errors;
    throw error;
  }

  return data;
}

export const api = {
  passengerSignup: (body) => request("/auth/passenger/signup", { method: "POST", body }),
  passengerLogin: (body) => request("/auth/passenger/login", { method: "POST", body }),
  driverSignup: (body) => request("/auth/driver/signup", { method: "POST", body }),
  driverLogin: (body) => request("/auth/driver/login", { method: "POST", body }),
  me: (token) => request("/auth/me", { token }),
};