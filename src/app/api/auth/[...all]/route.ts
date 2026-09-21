import { getAuth } from "@/lib/auth";

// Better Auth's own endpoints (sign-in, sign-out, get-session). Sign-up is disabled.
export async function GET(request: Request) {
  return getAuth().handler(request);
}

export async function POST(request: Request) {
  return getAuth().handler(request);
}
