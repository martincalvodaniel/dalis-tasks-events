import { userIdSchema } from "@/schemas/primitives"
import { remotePullRequestSchema } from "@/schemas/remote-sync"

export const mixedPullRequestSchema = remotePullRequestSchema.safeExtend({
  expectedUserId: userIdSchema,
})
