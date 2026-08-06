export class InvalidWorldSqsMessageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidWorldSqsMessageError"
  }
}

export class ContentServerConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ContentServerConfigurationError"
  }
}
