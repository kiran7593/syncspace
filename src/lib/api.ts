
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
    body:
      options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.message || `API request failed: ${response.status}`,
    );

    Object.assign(error, {
      status: response.status,
      data,
    });

    throw error;
  }

  return data;
};
