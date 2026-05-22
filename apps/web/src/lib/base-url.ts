// Base URL for the application. Must be set via NEXT_PUBLIC_APP_URL env var.
// For local development: http://localhost:3000
// For Vercel deployment: https://enertech-crm.vercel.app (or your custom domain)
export const baseUrl = (
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
).trim().replace(/\/+$/, "");
