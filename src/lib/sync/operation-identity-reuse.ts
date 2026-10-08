import "server-only"

export class OperationIdentityReuseError extends Error {
  constructor() {
    super("Operation identity was reused with a different payload")
  }
}
