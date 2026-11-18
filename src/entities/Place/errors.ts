/** A deterministic identity already belongs to incompatible or protected state. */
export class PlaceIdentityConflictError extends Error {
  constructor(id: string | undefined) {
    super(`Place identity ${id ?? ""} cannot be safely reactivated`)
    this.name = "PlaceIdentityConflictError"
  }
}
