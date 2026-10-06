import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"

async function main(): Promise<void> {
  await getDatabase()
  console.log("Database indexes ensured.")
}

main()
  .finally(closeDatabaseConnection)
  .catch((error: unknown) => {
    console.error(`Database index bootstrap failed: ${String(error)}`)
    process.exitCode = 1
  })
