import { getWorkspaceIdentity } from "@/features/workspace/server-identity"

export async function GET() {
  const identity = await getWorkspaceIdentity()
  return Response.json(identity ?? { error: "Authentication required" }, {
    status: identity ? 200 : 401,
    headers: { "Cache-Control": "private, no-store" },
  })
}
