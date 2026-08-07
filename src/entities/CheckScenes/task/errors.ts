export class InvalidWorldSqsMessageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidWorldSqsMessageError"
  }
}

/** Deterministically invalid input: the declared scene identity is not covered by the authorized pointers. */
export class InvalidSceneBaseError extends InvalidWorldSqsMessageError {
  constructor(base: string | undefined) {
    super(`Scene base '${base || ""}' must be included in the entity pointers.`)
    this.name = "InvalidSceneBaseError"
  }
}

export class ContentServerConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ContentServerConfigurationError"
  }
}
