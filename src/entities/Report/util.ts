export function extension(type: string) {
  switch (type) {
    case "application/json":
      return ".json"
    default:
      return ""
  }
}
