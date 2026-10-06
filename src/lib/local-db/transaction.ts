"use client"

export interface LocalTransactionContext<Result> {
  transaction: IDBTransaction
  setResult: (result: Result) => void
  fail: (error: unknown) => void
}

// Queue only IndexedDB work here. Awaiting network/timers can auto-commit a transaction.
export function runLocalTransaction<Result>(
  database: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  queue: (context: LocalTransactionContext<Result>) => void
): Promise<Result> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(stores, mode)
    let result: Result
    let hasResult = false
    let failure: unknown
    const fail = (error: unknown) => {
      failure = error
      try {
        transaction.abort()
      } catch {
        reject(error)
      }
    }
    transaction.onabort = () =>
      reject(
        failure ?? transaction.error ?? new Error("Local transaction aborted")
      )
    transaction.oncomplete = () => {
      if (hasResult) resolve(result)
      else reject(new Error("Local transaction completed without a result"))
    }
    try {
      const returned = queue({
        transaction,
        setResult: (value) => {
          result = value
          hasResult = true
        },
        fail,
      })
      if (returned !== undefined) {
        fail(new Error("Local transaction callback must be synchronous"))
      }
    } catch (error) {
      fail(error)
    }
  })
}
