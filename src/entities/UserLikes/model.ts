import { Model } from "decentraland-gatsby/dist/entities/Database/model"

import { UserLikeAttributes } from "./types"

export default class UserLikesModel extends Model<UserLikeAttributes> {
  static tableName = "user_likes"
  static primaryKey = "user"

  /** create or update a new like record */
  static async like(
    data: Pick<UserLikeAttributes, "user" | "place_id">,
    expected: Partial<Pick<UserLikeAttributes, "like" | "user_activity">> = {}
  ): Promise<UserLikeAttributes> {
    const now = new Date()
    const result = await this.findOne<UserLikeAttributes>(data)
    const like = expected.like ?? true
    const user_activity = expected.user_activity ?? 0

    if (!result) {
      const newLike: UserLikeAttributes = {
        ...data,
        like,
        user_activity,
        created_at: now,
        updated_at: now,
      }

      await this.createOne(newLike)
      return newLike
    }

    if (result.like !== like) {
      const update: Pick<
        UserLikeAttributes,
        "like" | "user_activity" | "updated_at"
      > = {
        like,
        user_activity,
        updated_at: now,
      }

      await this.update<UserLikeAttributes>(update, data)

      return {
        ...result,
        ...update,
      }
    }

    return result
  }
}
