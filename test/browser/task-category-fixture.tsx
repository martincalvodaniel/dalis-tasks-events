import { SWRConfig } from "swr"
import { TaskList } from "@/features/tasks/components/task-list"
import type { LocalAccount } from "@/features/workspace/local-account"

const cache = new Map()
const configuration = { provider: () => cache }

export function TaskCategoryFixture({ account }: { account: LocalAccount }) {
  return (
    <SWRConfig value={configuration}>
      <TaskList account={account} />
    </SWRConfig>
  )
}
