const API_URL = import.meta.env.VITE_API_URL;

type ApiRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

export const apiRequest = async (
  endpoint: string,
  options: ApiRequestOptions = {},
) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
};