import type { CardRepository } from '../../ports/repositories'
import type { Card } from '../../domain/models'
import type { CardId, CardRecordId, HospitalNo, PatientId } from '../../domain/ids'

/** In-memory CardRepository for the single-station MVP and for tests. */
export class InMemoryCardRepository implements CardRepository {
  readonly #byId = new Map<string, Card>()

  async create(card: Card): Promise<Card> {
    this.#byId.set(card.id, card)
    return card
  }

  async save(card: Card): Promise<Card> {
    this.#byId.set(card.id, card)
    return card
  }

  async findById(id: CardRecordId): Promise<Card | null> {
    return this.#byId.get(id) ?? null
  }

  async findByCardId(cardId: CardId): Promise<Card | null> {
    for (const card of this.#byId.values()) {
      if (card.cardId === cardId) return card
    }
    return null
  }

  async findActiveByHospitalNo(hospitalNo: HospitalNo): Promise<Card | null> {
    for (const card of this.#byId.values()) {
      if (card.hospitalNo === hospitalNo && card.status === 'ACTIVE') return card
    }
    return null
  }

  async listByPatient(patientId: PatientId): Promise<Card[]> {
    return Array.from(this.#byId.values())
      .filter((c) => c.patientId === patientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async listAll(): Promise<Card[]> {
    return Array.from(this.#byId.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}
