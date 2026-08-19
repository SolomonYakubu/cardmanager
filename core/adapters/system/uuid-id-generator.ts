import { randomUUID } from 'node:crypto'
import type { IdGenerator } from '../../ports/system'
import { CardId } from '../../domain/ids'

/** Real id generator backed by UUIDv4. Used in the running app. */
export class UuidIdGenerator implements IdGenerator {
  newId(): string {
    return randomUUID()
  }

  newCardId(): CardId {
    return CardId(`card_${randomUUID()}`)
  }
}
