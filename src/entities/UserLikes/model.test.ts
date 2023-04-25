import { userLikeFalse, userLikeTrue } from "../../__data__/entities"
import UserLikesModel from "./model"

const find = jest.spyOn(UserLikesModel, "findOne")
const create = jest.spyOn(UserLikesModel, "createOne")
const update = jest.spyOn(UserLikesModel, "update")

afterEach(() => {
  find.mockReset()
  create.mockReset()
  update.mockReset()
})

describe("UserLikesModel", () => {
  test("should return an object with UserLikeAttributes with the new like", async () => {
    find.mockResolvedValueOnce(Promise.resolve())
    create.mockResolvedValueOnce(Promise.resolve(1))
    const newLike = await UserLikesModel.like(
      {
        user: "0x8Cff6832174091DAe86F0244e3Fd92d4CeD2Fe07",
        place_id: "67b4c5c3-6b2c-4521-9253-cc3a3f8ce138",
      },
      { like: true, user_activity: 0 }
    )

    expect(newLike).toEqual({
      ...userLikeTrue,
      created_at: newLike.created_at,
      updated_at: newLike.updated_at,
    })
    expect(find.mock.calls.length).toBe(1)
    expect(create.mock.calls.length).toBe(1)
  })
  test("should return an object with UserLikeAttributes with a change from like to unlike", async () => {
    find.mockResolvedValueOnce(Promise.resolve(userLikeTrue))
    const updateLike = await UserLikesModel.like(
      {
        user: "0x8Cff6832174091DAe86F0244e3Fd92d4CeD2Fe07",
        place_id: "67b4c5c3-6b2c-4521-9253-cc3a3f8ce138",
      },
      { like: false, user_activity: 0 }
    )
    update.mockResolvedValueOnce(Promise.resolve(userLikeFalse))
    expect(updateLike).toEqual({
      ...userLikeFalse,
      created_at: updateLike.created_at,
      updated_at: updateLike.updated_at,
    })
    expect(find.mock.calls.length).toBe(1)
    expect(create.mock.calls.length).toBe(0)
    expect(update.mock.calls.length).toBe(1)
  })
  test("should return an object with UserLikeAttributes with no changes if like have the same state", async () => {
    find.mockResolvedValueOnce(Promise.resolve(userLikeTrue))
    const newLike = await UserLikesModel.like(
      {
        user: "0x8Cff6832174091DAe86F0244e3Fd92d4CeD2Fe07",
        place_id: "67b4c5c3-6b2c-4521-9253-cc3a3f8ce138",
      },
      { like: true, user_activity: 0 }
    )
    expect(newLike).toEqual(userLikeTrue)
    expect(find.mock.calls.length).toBe(1)
    expect(create.mock.calls.length).toBe(0)
    expect(update.mock.calls.length).toBe(0)
  })
})
