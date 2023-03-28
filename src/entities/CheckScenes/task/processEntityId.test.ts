import ContentServer from "decentraland-gatsby/dist/utils/api/ContentServer"

import {
  contentEntitySceneGenesisPlaza,
  contentEntitySceneRoad,
  sqsMessage,
  sqsMessageRoad,
  sqsMessageWithWrongEntityId,
} from "../../../__data__/entities"
import { processEntityId } from "./processEntityId"

const contentEntityScene = jest.spyOn(
  ContentServer.getInstanceFrom(sqsMessage.contentServerUrls![0]),
  "getContentEntity"
)

afterEach(() => {
  contentEntityScene.mockReset()
})

test("should accept a DeploymentToSqs and throw an error when contentDeployment found is a road", async () => {
  contentEntityScene.mockResolvedValueOnce(
    Promise.resolve(contentEntitySceneRoad)
  )

  await expect(async () =>
    processEntityId(sqsMessageRoad)
  ).rejects.toThrowError()

  expect(contentEntityScene.mock.calls.length).toBe(1)
})

test("should accept a DeploymentToSqs and throw an error when no contentDeployment found", async () => {
  contentEntityScene.mockResolvedValueOnce(
    Promise.resolve(contentEntitySceneRoad)
  )

  await expect(async () =>
    processEntityId(sqsMessageWithWrongEntityId)
  ).rejects.toThrowError()

  expect(contentEntityScene.mock.calls.length).toBe(1)
})

test("should accept a DeploymentToSqs and return a ContentEntityScene", async () => {
  contentEntityScene.mockResolvedValueOnce(
    Promise.resolve(contentEntitySceneGenesisPlaza)
  )

  const contentDeployment = await processEntityId(sqsMessage)
  expect(contentDeployment).toEqual(contentEntitySceneGenesisPlaza)

  expect(contentEntityScene.mock.calls.length).toBe(1)
})
