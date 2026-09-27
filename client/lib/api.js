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
    listZones: () => request("/zones"),
  getFareEstimate: (params) =>
    request(`/zones/fare-estimate?${new URLSearchParams(params).toString()}`),

  createRide: (body, token) => request("/rides", { method: "POST", body, token }),
  getMyRides: (token, status) =>
    request(`/rides/me${status ? `?status=${status}` : ""}`, { token }),
  getRide: (id, token) => request(`/rides/${id}`, { token }),
  cancelRide: (id, token) => request(`/rides/${id}/cancel`, { method: "PATCH", token }),

  createPayment: (body, token) => request("/payments", { method: "POST", body, token }),
  createVehicle: (body, token) => request("/vehicles", { method: "POST", body, token }),
  getMyVehicles: (token) => request("/vehicles/me", { token }),

  setDriverStatus: (body, token) => request("/drivers/status", { method: "PATCH", body, token }),

  getAvailableRequests: (token, pickupZoneId) =>
    request(`/pools/available-requests${pickupZoneId ? `?pickup_zone_id=${pickupZoneId}` : ""}`, { token }),
  getMyPools: (token, status) =>
    request(`/pools/mine${status ? `?status=${status}` : ""}`, { token }),
  getMyPoolsDetailed: (token, status) =>
    request(`/pools/mine/detailed${status ? `?status=${status}` : ""}`, { token }),
  createPool: (body, token) => request("/pools", { method: "POST", body, token }),
  joinPool: (id, body, token) => request(`/pools/${id}/join`, { method: "POST", body, token }),
  getPool: (id, token) => request(`/pools/${id}`, { token }),
  acceptPool: (id, token) => request(`/pools/${id}/accept`, { method: "PATCH", token }),
  markPoolArrived: (id, token) => request(`/pools/${id}/arrived`, { method: "PATCH", token }),
  startPool: (id, token) => request(`/pools/${id}/start`, { method: "PATCH", token }),
  completePool: (id, token) => request(`/pools/${id}/complete`, { method: "PATCH", token }),
  cancelPool: (id, token) => request(`/pools/${id}/cancel`, { method: "PATCH", token }),
  getRouteGraph: () => request("/zones/graph"),
  getRideRoute: (id, token) => request(`/rides/${id}/route`, { token }),
};