import { NextResponse } from "next/server";

/** Unauthenticated liveness probe for load balancers / k8s. */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "kubepilot-frontend",
    },
    { status: 200 },
  );
}
