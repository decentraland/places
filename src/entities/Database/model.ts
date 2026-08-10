import { AsyncLocalStorage } from "async_hooks"

import { Model as GatsbyModel } from "decentraland-gatsby/dist/entities/Database/model"
import { SQLStatement } from "decentraland-gatsby/dist/entities/Database/utils"
import { Client } from "pg"

const transactionStorage = new AsyncLocalStorage<Client>()

export async function withDatabaseTransaction<T>(
  callback: () => Promise<T>
): Promise<T> {
  if (transactionStorage.getStore()) return callback()

  const connectionString = process.env.CONNECTION_STRING
  if (!connectionString) return callback()

  const client = new Client({ connectionString })
  await client.connect()
  try {
    const schema = new URL(connectionString).searchParams.get("schema")
    if (schema) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
        throw new Error("Invalid database schema in CONNECTION_STRING")
      }
      await client.query(`SET search_path TO "${schema}"`)
    }
    await client.query("BEGIN")
    const result = await transactionStorage.run(client, callback)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

export class Model<T extends {}> extends GatsbyModel<T> {
  static async namedQuery<U extends {} = any>(
    name: string,
    query: SQLStatement
  ): Promise<U[]> {
    const client = transactionStorage.getStore()
    if (!client) return super.namedQuery<U>(name, query)
    try {
      const result = await client.query(query.text, query.values)
      return result.rows as U[]
    } catch (error) {
      throw Object.assign(error as Record<string, unknown>, {
        text: query.text,
        values: query.values,
      })
    }
  }

  static async namedRowCount(
    name: string,
    query: SQLStatement
  ): Promise<number> {
    const client = transactionStorage.getStore()
    if (!client) return super.namedRowCount(name, query)
    try {
      const result = await client.query(query.text, query.values)
      return result.rowCount ?? 0
    } catch (error) {
      throw Object.assign(error as Record<string, unknown>, {
        text: query.text,
        values: query.values,
      })
    }
  }
}
