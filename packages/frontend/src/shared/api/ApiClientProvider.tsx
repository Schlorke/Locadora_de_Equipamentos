"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createHttpClient, type HttpClient } from "./http-client";

const defaultClient = createHttpClient();
const ApiClientContext = createContext<HttpClient>(defaultClient);

export function ApiClientProvider({ client = defaultClient, children }: { client?: HttpClient; children: ReactNode }) {
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

export function useApiClient(): HttpClient {
  return useContext(ApiClientContext);
}
