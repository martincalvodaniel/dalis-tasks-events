import { type ChildProcess, spawn } from "node:child_process"
import { createServer, type Server, type Socket } from "node:net"
import {
  syncTestImage,
  syncTestProcessEnvironment,
} from "@/config/sync-test-runner"
import { syncDatabaseTestConfigSchema } from "@/schemas/sync-database-test"

const runId = crypto.randomUUID()
const name = `dalis-sync-test-${runId}`
const label = "dalis.sync-test-run"
let activeChild: ReturnType<typeof Bun.spawn> | undefined
let interrupted = false
let bridgeServer: Server | undefined
const bridgeSockets = new Set<Socket>()
const bridgeChildren = new Set<ChildProcess>()
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    interrupted = true
    activeChild?.kill()
  })

async function command(args: string[], allowFailure = false) {
  if (interrupted && args[1] !== "inspect" && args[1] !== "rm")
    throw new Error("Isolated test run interrupted")
  const child = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" })
  activeChild = child
  const timeout = setTimeout(() => child.kill(), 15000)
  const [exitCode, output] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  clearTimeout(timeout)
  activeChild = undefined
  if (exitCode !== 0 && !allowFailure)
    throw new Error(`Test runner command failed: ${args[0]} ${args[1]}`)
  return { exitCode, output: output.trim() }
}

async function inspectOwnedContainer() {
  const result = await command(["docker", "inspect", name], true)
  if (result.exitCode !== 0) return null
  const [container] = JSON.parse(result.output)
  if (
    container.Name !== `/${name}` ||
    container.Config.Labels[label] !== runId ||
    container.Config.Image !== syncTestImage
  )
    throw new Error(
      "Refusing to use or clean a container not owned by this run"
    )
  return container
}

async function ready(script: string) {
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    const result = await command(
      ["docker", "exec", name, "mongosh", "--quiet", "--eval", script],
      true
    )
    if (result.exitCode === 0) return
    await Bun.sleep(500)
  }
  throw new Error("Isolated replica set did not become ready before timeout")
}

async function startBridge(): Promise<number> {
  const server = createServer((socket) => {
    bridgeSockets.add(socket)
    const child = spawn(
      "docker",
      [
        "exec",
        "-i",
        name,
        "bash",
        "-c",
        'exec 3<>/dev/tcp/127.0.0.1/27017; cat <&3 & reader=$!; cat >&3; kill "$reader" 2>/dev/null; exec 3>&-; wait',
      ],
      { stdio: ["pipe", "pipe", "ignore"] }
    )
    bridgeChildren.add(child)
    const { stdin, stdout } = child
    if (!stdin || !stdout) {
      socket.destroy()
      child.kill()
      bridgeChildren.delete(child)
      return
    }
    socket.pipe(stdin)
    stdout.pipe(socket)
    stdin.on("error", () => socket.destroy())
    child.on("error", () => socket.destroy())
    child.on("exit", () => {
      bridgeChildren.delete(child)
      socket.destroy()
    })
    socket.on("error", () => child.kill())
    socket.on("close", () => {
      bridgeSockets.delete(socket)
      child.kill()
    })
  })
  bridgeServer = server
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = bridgeServer.address()
  if (
    !address ||
    typeof address === "string" ||
    address.address !== "127.0.0.1"
  )
    throw new Error("Test bridge must listen on loopback")
  return address.port
}

try {
  await command([
    "docker",
    "run",
    "--detach",
    "--pull=never",
    "--platform",
    "linux/amd64",
    "--name",
    name,
    "--label",
    `${label}=${runId}`,
    "--tmpfs",
    "/data/db",
    syncTestImage,
    "mongod",
    "--replSet",
    "dalis-sync-test",
    "--bind_ip_all",
  ])
  if (!(await inspectOwnedContainer()))
    throw new Error("Owned test container is unavailable")
  const port = await startBridge()
  const config = syncDatabaseTestConfigSchema.parse({
    runId,
    port,
    mongodbDatabase: name,
    mongodbUri: `mongodb://127.0.0.1:${port}/?replicaSet=dalis-sync-test&directConnection=true`,
  })
  await ready("if (!db.adminCommand({ping:1}).ok) quit(1)")
  await command([
    "docker",
    "exec",
    name,
    "mongosh",
    "--quiet",
    "--eval",
    'rs.initiate({_id:"dalis-sync-test",members:[{_id:0,host:"127.0.0.1:27017"}]})',
  ])
  await ready("if (!db.hello().isWritablePrimary) quit(1)")
  const testProcess = Bun.spawn(
    [
      "bun",
      "--no-env-file",
      "test",
      "--preload",
      "./test/setup.ts",
      "src/lib/db/transactions.integration.test.ts",
      "src/lib/db/remote-items.integration.test.ts",
      "src/lib/db/remote-item-commands.integration.test.ts",
      "src/lib/db/remote-changes.integration.test.ts",
    ],
    {
      env: syncTestProcessEnvironment(config),
      stdout: "inherit",
      stderr: "inherit",
    }
  )
  activeChild = testProcess
  const testExitCode = await testProcess.exited
  activeChild = undefined
  if (testExitCode !== 0)
    throw new Error("Isolated database integration tests failed")
  console.info("Isolated transaction tests passed.")
} finally {
  for (const socket of bridgeSockets) socket.destroy()
  for (const child of bridgeChildren) child.kill()
  const server = bridgeServer
  if (server?.listening)
    await new Promise<void>((resolve) => server.close(() => resolve()))
  const container = await inspectOwnedContainer()
  if (container) {
    await command(["docker", "rm", "--force", "--volumes", container.Id])
    console.info("Owned test container and temporary storage removed.")
  }
}
