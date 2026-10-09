import { randomUUID } from "node:crypto"
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { join, resolve } from "node:path"
import {
  getNextSyncRunnerConfig,
  nextSyncProcessEnvironment,
} from "@/config/next-sync-test"
import {
  nextSyncDiagnosticSchema,
  nextSyncFinishSchema,
  nextSyncPublicConfigSchema,
} from "@/schemas/next-sync-test"

const { descriptor, path } = getNextSyncRunnerConfig()
const root = resolve(import.meta.dir, "..")
const directory = join(root, "build", `dalis-next-sync-${descriptor.runId}`)
const children: Bun.Subprocess[] = []
let completed = false
let finish: (passed: boolean) => void = () => {}
const finished = new Promise<boolean>((resolveFinish) => {
  finish = resolveFinish
})
const deadline = setTimeout(
  () => {
    completed = true
    for (const child of children)
      if (child.exitCode === null) child.kill("SIGTERM")
    finish(false)
  },
  10 * 60 * 1000
)
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    completed = true
    for (const child of children)
      if (child.exitCode === null) child.kill("SIGTERM")
    finish(false)
  })
const control = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    try {
      if (
        request.method !== "POST" ||
        new URL(request.url).pathname !== "/finish"
      )
        return new Response(null, { status: 404 })
      const input = nextSyncFinishSchema.parse(await request.json())
      if (
        input.runId !== descriptor.runId ||
        request.headers.get("x-sync-test-run") !== descriptor.runId
      )
        return new Response(null, { status: 403 })
      completed = true
      setTimeout(() => finish(input.passed), 150)
      return Response.json({ accepted: true })
    } catch {
      return new Response(null, { status: 400 })
    }
  },
})

async function reservePorts() {
  const reservations = [createServer(), createServer()]
  try {
    const ports = await Promise.all(
      reservations.map(
        (server) =>
          new Promise<number>((resolvePort, reject) => {
            server.once("error", reject)
            server.listen(0, "127.0.0.1", () => {
              const address = server.address()
              if (!address || typeof address === "string")
                reject(new Error("Fixture port reservation failed"))
              else resolvePort(address.port)
            })
          })
      )
    )
    return ports
  } finally {
    await Promise.all(
      reservations.map(
        (server) =>
          new Promise<void>((resolveClose) =>
            server.close(() => resolveClose())
          )
      )
    )
  }
}
async function copyTemplates(source: string, target: string) {
  await mkdir(target, { recursive: true })
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const destination = join(target, entry.name.replace(/\.template$/, ""))
    if (entry.isDirectory())
      await copyTemplates(join(source, entry.name), destination)
    else if (entry.name.endsWith(".template"))
      await cp(join(source, entry.name), destination)
  }
}
const [primaryPort, secondaryPort] = await reservePorts()
const origins: [string, string] = [
  `http://127.0.0.1:${primaryPort}`,
  `http://localhost:${secondaryPort}`,
]
const config = {
  ...descriptor,
  origins,
  controlOrigin: control.url.origin,
  authOrigin: origins[0],
  secret: `dalis-next-test-${randomUUID()}${randomUUID()}`,
}
const environment = nextSyncProcessEnvironment(config, path)
let ownedDirectory = false
let stage = "prepare"
let readinessStatus = 0
let readinessDiagnostic = "unavailable"
async function runNext(arguments_: string[], env: Record<string, string>) {
  if (completed) throw new Error("Next fixture was interrupted")
  const child = Bun.spawn(
    ["node", join(root, "node_modules/next/dist/bin/next"), ...arguments_],
    { cwd: directory, env, stdout: "pipe", stderr: "pipe" }
  )
  children.push(child)
  const output = new Response(child.stdout).text()
  const errors = new Response(child.stderr).text()
  const exit = await child.exited
  const logs = (await Promise.all([output, errors])).join("\n")
  if (exit !== 0) {
    // Build diagnostics contain source locations, but never echo auth configuration or sessions.
    const sanitized = logs
      .replaceAll(config.secret, "[redacted]")
      .replaceAll(environment.GOOGLE_CLIENT_SECRET, "[redacted]")
      .replace(
        /(?:better-auth\.[\w.-]+|token|cookie|secret)[=:][^\s]+/gi,
        "[redacted]"
      )
    process.stderr.write(sanitized)
    throw new Error("Isolated Next fixture command failed")
  }
}
async function waitReady(origin: string, child: Bun.Subprocess) {
  readinessStatus = 0
  readinessDiagnostic = "unavailable"
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    if (completed) throw new Error("Next fixture was interrupted")
    if (child.exitCode !== null)
      throw new Error("Isolated Next fixture exited before readiness")
    let response: Response | null = null
    try {
      response = await fetch(
        `${origin}/fixture/config?runId=${descriptor.runId}`,
        { signal: AbortSignal.timeout(1000) }
      )
    } catch {}
    if (response) {
      readinessStatus = response.status
      if (response.ok) {
        const parsed = nextSyncPublicConfigSchema.safeParse(
          await response.json().catch(() => null)
        )
        if (
          !parsed.success ||
          parsed.data.runId !== descriptor.runId ||
          JSON.stringify(parsed.data.origins) !== JSON.stringify(origins)
        )
          throw new Error("Next fixture readiness ownership is invalid")
        return
      }
      if (response.status === 403) {
        const diagnostic = nextSyncDiagnosticSchema.safeParse(
          await response.json().catch(() => null)
        )
        readinessDiagnostic = diagnostic.success
          ? diagnostic.data.diagnostic
          : "unrecognized_response"
      }
      if (response.status !== 503)
        throw new Error("Next fixture readiness request was rejected")
    }
    await Bun.sleep(200)
  }
  throw new Error("Isolated Next fixture readiness timed out")
}
let passed = false
try {
  await mkdir(join(root, "build"), { recursive: true })
  await mkdir(directory, { recursive: false })
  ownedDirectory = true
  await writeFile(
    join(directory, "fixture-owner.json"),
    JSON.stringify({ runId: descriptor.runId, directory })
  )
  await copyTemplates(join(root, "test/next-sync"), directory)
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({
      private: true,
      name: `dalis-next-sync-${descriptor.runId}`,
    })
  )
  await writeFile(
    join(directory, "next.config.ts"),
    `import type { NextConfig } from "next"\nconst config: NextConfig = { turbopack: { root: ${JSON.stringify(root)} } }\nexport default config\n`
  )
  await writeFile(
    join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2017",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "react-jsx",
        plugins: [{ name: "next" }],
        paths: { "@/*": ["../../src/*"], "@fixture/*": ["./features/*"] },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    })
  )
  stage = "build"
  await runNext(["build", directory], environment)
  process.stdout.write("Next sync fixture build passed\n")
  for (let index = 0; index < origins.length; index++) {
    stage = index === 0 ? "start_primary" : "start_secondary"
    if (completed) throw new Error("Next fixture was interrupted")
    const child = Bun.spawn(
      [
        "node",
        join(root, "node_modules/next/dist/bin/next"),
        "start",
        directory,
        "--hostname",
        new URL(origins[index]).hostname,
        "--port",
        String([primaryPort, secondaryPort][index]),
      ],
      {
        cwd: directory,
        env: nextSyncProcessEnvironment(
          { ...config, authOrigin: origins[index] },
          path
        ),
        stdout: "ignore",
        stderr: "ignore",
      }
    )
    children.push(child)
    child.exited.then(() => {
      if (!completed) finish(false)
    })
    await waitReady(origins[index], child)
  }
  process.stdout.write(
    `Next sync fixture ready: ${origins[0]}/?run=${descriptor.runId}\n`
  )
  stage = "browser_wait"
  passed = await finished
} catch {
  process.stderr.write(
    `Isolated Next sync fixture failed at ${stage}; readiness HTTP ${readinessStatus}; category ${readinessDiagnostic}; only owned resources will be cleaned\n`
  )
} finally {
  clearTimeout(deadline)
  completed = true
  for (const child of children)
    if (child.exitCode === null) child.kill("SIGTERM")
  const force = setTimeout(() => {
    for (const child of children)
      if (child.exitCode === null) child.kill("SIGKILL")
  }, 4000)
  await Promise.allSettled(children.map((child) => child.exited))
  clearTimeout(force)
  await control.stop(true)
  if (ownedDirectory) {
    const ownership = JSON.parse(
      await readFile(join(directory, "fixture-owner.json"), "utf8")
    ) as { runId?: string; directory?: string }
    if (
      ownership.runId === descriptor.runId &&
      ownership.directory === directory
    )
      await rm(directory, { recursive: true })
    else
      process.stderr.write("Next fixture ownership changed; files preserved\n")
  }
}
process.exitCode = passed ? 0 : 1
