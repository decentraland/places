import ContentServer from "decentraland-gatsby/dist/utils/api/ContentServer"

import {
  contentEntitySceneGenesisPlaza,
  exampleContentEntityProfile,
  sqsMessage,
  sqsMessageProfile,
  sqsMessageRoad,
} from "../../../__data__/entities"
import { processEntityId } from "./processEntityId"

const contentEntityScene = jest.spyOn(
  ContentServer.getInstanceFrom(sqsMessage.contentServerUrls![0]),
  "getContentEntity"
)

afterEach(() => {
  contentEntityScene.mockReset()
})

test("should return a ContentEntityScene", async () => {
  contentEntityScene.mockResolvedValueOnce(
    Promise.resolve(contentEntitySceneGenesisPlaza)
  )

  const contentDeployment = await processEntityId(sqsMessage)
  expect(contentDeployment).toEqual(contentEntitySceneGenesisPlaza)

  expect(contentEntityScene.mock.calls.length).toBe(1)
})

test("should throw an error when there is no contentServerUrls", async () => {
  await expect(async () =>
    processEntityId({ ...sqsMessageRoad, contentServerUrls: undefined })
  ).rejects.toThrowError()
})

test("should throw an error when is not an escene", async () => {
  contentEntityScene.mockResolvedValueOnce(
    Promise.resolve(exampleContentEntityProfile)
  )
  await expect(async () =>
    processEntityId(sqsMessageProfile)
  ).rejects.toThrowError()
})
