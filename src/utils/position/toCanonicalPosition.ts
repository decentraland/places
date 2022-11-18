import { isInsideWorldLimits } from "@dcl/schemas/dist/dapps/world"

function toCanonicalPosition(positionString?: string | null, glue = ".") {
  if (!positionString) return null
  const position = positionString.split(/[,.;|]+/).map((pos) => Number(pos))
  if (
    position.length !== 2 ||
    !Number.isFinite(position[0]) ||
    !Number.isFinite(position[1]) ||
    !isInsideWorldLimits(position[0], position[1])
  ) {
    return null
  }
  return position.join(glue)
}

export default toCanonicalPosition
