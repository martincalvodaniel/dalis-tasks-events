import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"

async function main(): Promise<void> {
  await getDatabase()
  console.log("Database indexes ensured.")
}

main()
  .finally(closeDatabaseConnection)
  .catch(() => {
    console.error("Database index bootstrap failed.")
    process.exitCode = 1
  })
