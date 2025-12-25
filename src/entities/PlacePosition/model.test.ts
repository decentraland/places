import PlacePositionModel from "./model"
import { placeGenesisPlaza } from "../../__data__/placeGenesisPlaza"

const namedQuery = jest.spyOn(PlacePositionModel, "namedQuery")
const namedRowCount = jest.spyOn(PlacePositionModel, "namedRowCount")

beforeEach(() => {
  namedQuery.mockReset()
  namedRowCount.mockReset()
})

describe(`findeBasePositions`, () => {
  test(`should return an empty list if receive an empty list`, async () => {
    namedQuery.mockResolvedValue([])
    expect(await PlacePositionModel.findeBasePositions([])).toEqual([])
    expect(namedQuery.mock.calls.length).toBe(0)
  })

  test(`should return a list of places matching the parameters sent`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlaza])
    expect(await PlacePositionModel.findeBasePositions(["0,0"])).toEqual([
      placeGenesisPlaza,
    ])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_base_positions")
    expect(sql.values).toEqual(["0,0"])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT DISTINCT(base_position)
        FROM "place_positions"
        WHERE position IN ($1)
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})

describe(`removePositions`, () => {
  test(`should return 0 if receive an empty list`, async () => {
    namedQuery.mockResolvedValue([])
    expect(await PlacePositionModel.removePositions([])).toEqual(0)
    expect(namedQuery.mock.calls.length).toBe(0)
  })

  test(`should return the number of erased positions with the parameters sent`, async () => {
    namedRowCount.mockResolvedValue(1)
    expect(await PlacePositionModel.removePositions(["0,0"])).toEqual(1)
    expect(namedRowCount.mock.calls.length).toBe(1)
    const [name, sql] = namedRowCount.mock.calls[0]
    expect(name).toBe("remove_positions")
    expect(sql.values).toEqual(["0,0"])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        DELETE FROM "place_positions"
        WHERE position IN ($1)
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})

describe(`syncBasePosition`, () => {
  test(`should return 0 if the place do not have positions`, async () => {
    namedQuery.mockResolvedValue([])
    expect(
      await PlacePositionModel.syncBasePosition({
        base_position: "0,0",
        positions: [],
      })
    ).toEqual(0)
    expect(namedQuery.mock.calls.length).toBe(0)
  })

  test(`should return pass all the process`, async () => {
    const existingPositions = [
      {
        base_position: placeGenesisPlaza.base_position,
        position: "-1,-1",
      },
      {
        base_position: placeGenesisPlaza.base_position,
        position: "-1,-2",
      },
    ]
    namedQuery.mockResolvedValue(existingPositions)
    namedRowCount.mockResolvedValue(
      placeGenesisPlaza.positions.length - existingPositions.length
    )
    namedRowCount.mockResolvedValue(existingPositions.length)
    namedRowCount.mockResolvedValue(0)

    expect(
      await PlacePositionModel.syncBasePosition({
        ...placeGenesisPlaza,
        positions: placeGenesisPlaza.positions,
      })
    ).toEqual(0)

    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_existing_positions")
    expect(sql.values).toEqual(placeGenesisPlaza.positions)
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT * FROM "place_positions" WHERE position IN ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64, $65, $66, $67, $68, $69, $70)
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )

    expect(namedRowCount.mock.calls.length).toBe(3)
    const [nameUpdate, sqlUpdate] = namedRowCount.mock.calls[0]
    expect(nameUpdate).toBe("update_base_positions")
    expect(sqlUpdate.values).toEqual([
      placeGenesisPlaza.base_position,
      ...placeGenesisPlaza.positions,
    ])
    expect(sqlUpdate.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        UPDATE "place_positions"
          SET base_position = $1
          WHERE position IN ($2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64, $65, $66, $67, $68, $69, $70, $71)
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )

    const missingPositions = new Set(placeGenesisPlaza.positions)
    existingPositions.forEach((position) =>
      missingPositions.delete(position.position)
    )
    const [nameInsert, sqlInsert] = namedRowCount.mock.calls[1]
    expect(nameInsert).toBe("create_base_positions")
    expect(sqlInsert.values).toEqual(
      Array.from(missingPositions)
        .map((position) => [position, placeGenesisPlaza.base_position])
        .flat()
    )

    expect(sqlInsert.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        INSERT INTO "place_positions" (position, base_position)
        VALUES  ($1, $2), ($3, $4), ($5, $6), ($7, $8), ($9, $10), ($11, $12), ($13, $14), ($15, $16), ($17, $18), ($19, $20), ($21, $22), ($23, $24), ($25, $26), ($27, $28), ($29, $30), ($31, $32), ($33, $34), ($35, $36), ($37, $38), ($39, $40), ($41, $42), ($43, $44), ($45, $46), ($47, $48), ($49, $50), ($51, $52), ($53, $54), ($55, $56), ($57, $58), ($59, $60), ($61, $62), ($63, $64), ($65, $66), ($67, $68), ($69, $70), ($71, $72), ($73, $74), ($75, $76), ($77, $78), ($79, $80), ($81, $82), ($83, $84), ($85, $86), ($87, $88), ($89, $90), ($91, $92), ($93, $94), ($95, $96), ($97, $98), ($99, $100), ($101, $102), ($103, $104), ($105, $106), ($107, $108), ($109, $110), ($111, $112), ($113, $114), ($115, $116), ($117, $118), ($119, $120), ($121, $122), ($123, $124), ($125, $126), ($127, $128), ($129, $130), ($131, $132), ($133, $134), ($135, $136)
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )

    const [nameDelete, sqlDelete] = namedRowCount.mock.calls[2]
    expect(nameDelete).toBe("remove_base_positions")
    expect(sqlDelete.values).toEqual([
      placeGenesisPlaza.base_position,
      ...placeGenesisPlaza.positions,
    ])
    expect(sqlDelete.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        DELETE FROM "place_positions"
        WHERE
          base_position = $1
          AND position NOT IN ($2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64, $65, $66, $67, $68, $69, $70, $71)
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})
