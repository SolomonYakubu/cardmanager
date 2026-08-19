# Hospital Patient Check-In Card System — Full Spec (Build-Ready)

## 0. Overview

A card-issuance and check-in system for hospital patients. Each patient is issued a physical card carrying three independent, purpose-specific channels — NFC, QR, barcode — used for fast check-in, clinical record lookup, and physical-card authenticity verification respectively. Built as a desktop app (Electron) to allow direct hardware access (card printer, NFC encoder/reader) without native-only development.

---

## 1. Identifier model

Three channels, three distinct jobs — not the same value duplicated across all three:

| Channel | Carries | Job |
|---|---|---|
| **NFC** | `card_id` + `hospital_no` (two data records) | Primary tap-to-identify at check-in |
| **QR code** | Link into the patient's EMR | Clinical staff jump straight to the chart |
| **Barcode** | `originality_code` (verification value, not an identifier) | Anti-forgery check on the physical card itself |

| ID | What it is | Where it lives |
|---|---|---|
| `hospital_no` | Patient's existing hospital number, fixed for life | DB, printed text, NFC |
| `card_id` | Identifier for *this physical card instance*; changes every reissue | DB, NFC |
| `originality_code` | Derived from `card_id` via a keyed signature (HMAC), unique per card | DB, barcode only |

**EMR link caveat:** the QR is a navigation shortcut, not an access grant. The link must still require the scanning device's own authenticated EMR session before the chart loads — a dropped or photographed card should not hand out chart access.

**Originality code caveat:** a keyed signature catches *forgery* (no key → can't produce a valid code) but not *duplication* (photographing a real barcode onto a fake card). If duplication is a real risk in your setting, that's the trigger to move NFC to an authenticated chip tier (§4).

---

## 2. Feasibility assessment

| Component | Feasibility | Basis |
|---|---|---|
| Printer integration | High — solved problem | Every serious card printer vendor ships an SDK or exposes itself as a standard OS print driver |
| NFC read/write (NTAG tier) | High — solved problem | PC/SC-class readers plus standard libraries; no vendor lock-in |
| Barcode/QR generation | High — trivial | Standard libraries |
| Card rendering/templating | High | Standard 2D compositing, no novel requirement |
| Originality/HMAC scheme | High algorithmically; needs a real decision operationally | The work is key custody, not the algorithm |
| Electron as the host shell | High | Correct fit for direct USB/hardware access |
| Multi-station sync (if needed later) | Medium | Standard client-server problem, real work, don't build early |
| Authenticated-tier NFC (if ever needed) | Medium | Well-understood, but adds real key-management scope — a separate project phase |

**Verdict: feasible with off-the-shelf components throughout.** Nothing here requires unproven technology. The risk is in sequencing and discipline (verify-before-print, hardware abstraction, not skipping the state machine), not in any individual component being hard.

---

## 3. Process architecture

Renderer never touches hardware directly — this is the rule that keeps the system reliable and hardware-agnostic.

```
Renderer (UI)
    │  asks for outcomes only, no hardware knowledge
    ▼
Preload boundary (isolates renderer from Node/hardware access)
    ▼
Main process
    │
    ├── Services layer
    │     — Card Issuance
    │     — Card Verification / Check-in
    │     — Template Rendering
    │     — Audit Logging
    │
    └── Hardware abstraction layer
          — Printer Adapter (interface)
          — NFC Adapter (interface)
```

The services layer only ever talks to the *interfaces* in the hardware abstraction layer, never to a specific vendor's SDK.

---

## 4. Hardware abstraction layer

### Printer side — vendor-agnostic

```
Printer Adapter (interface)
      — connect / get status / print / cancel / disconnect
         │
         ├── Vendor-specific SDK implementation (e.g. Evolis, Zebra)
         └── Generic OS-print-driver implementation (fallback/default)
```

Two integration depths, same interface:
- **Driver-level (start here):** send rendered card artwork as a standard print job, sized to the card. Works with essentially any card printer, since they all register as OS printers. Less granular status/error feedback ("job sent"/"job failed").
- **SDK-level (add later, only for your deployed printer):** vendor-specific adapter with real status (ribbon out, jam, offline). More integration work, worth it once operational reliability matters more than build speed.

### NFC side — chip-family-agnostic within a vendor-neutral transport

```
NFC Adapter (interface)
      — connect / wait for card / read / write / verify (read-back+compare) / disconnect
         │
         ├── NTAG adapter (Path A — default)
         └── Authenticated-chip adapter (Path B — future, same interface)
```

PC/SC-class readers are largely interchangeable at the transport level — the adapter varies mainly by *chip family* (basic tag vs authenticated chip), not by reader brand.

---

## 5. Renderer capability surface

The renderer asks for outcomes, never vendor-specific operations — this is what lets hardware change without touching any screen:

- Create/issue a card for a patient
- Detect an NFC card present at the station
- Encode / verify / check in via NFC
- Print / verify a card
- Get vendor-neutral printer and reader status (ready / busy / error / offline)
- Void or reissue a card

---

## 6. Data model

**Patients** — internal ID, `hospital_no` (unique, patient-facing), name, date of birth, EMR reference, created date.

**Cards** — internal ID, `card_id`, link to patient, NFC chip UID (bound at issuance), `originality_code`, status, issued timestamp/operator, optional expiry.

Status values: `RESERVED → NFC_ENCODED → NFC_VERIFIED → PRINTED → PRINTED_VERIFIED → ACTIVE`, plus `LOST / VOID / EXPIRED / REPLACED`.

**Card events** — append-only log: which card, what happened, when, which station/operator, error detail on failures. Gives a full audit trail per card without overloading the main record.

---

## 7. Issuance flow

```
Select patient (hospital_no already on file)
      ↓
Generate card_id + originality_code for this physical card
      ↓
Create card record — RESERVED
      ↓
Detect NFC chip → bind chip UID to record
      ↓
Write card_id + hospital_no to chip
      ↓
Read back and verify → NFC_VERIFIED
      ↓
Render card artwork (name, photo, hospital_no, QR → EMR link, barcode → originality_code)
      ↓
Send to printer (via Printer Adapter)
      ↓
Scan printed barcode, confirm originality_code recomputes correctly → PRINTED_VERIFIED
      ↓
ACTIVE / ISSUED
      ↓
Log event
```

Each step writes its own event and advances the state machine one step at a time — a crash or failure at any point leaves a known, resumable state.

---

## 8. Check-in flow

```
Tap NFC (primary path)
      ↓
Read card_id + hospital_no directly off chip
      ↓
Look up card by card_id → confirm ACTIVE → cross-check hospital_no matches
      ↓
Pull patient record, staff visually confirms (skip for unattended/kiosk mode)
      ↓
Log CHECKED_IN

Independently, at any time:
Scan barcode → recompute originality_code → confirms the physical card is genuine
Scan QR → staff jumps to the patient's EMR chart (requires their own EMR login)
```

The three channels aren't sequential steps in one flow — NFC handles routine check-in, the barcode is a spot-check for authenticity, the QR is a clinical convenience.

---

## 9. Lost / reissued card handling

```
Report lost
      ↓
Old card status → VOID
      ↓
New card issued → same hospital_no, new card_id, new NFC UID, new originality_code
      ↓
Old physical card, even if found later:
   — NFC/card_id lookup fails the "current active card" check
   — barcode still recomputes correctly (it was genuinely issued once),
     but the card record is VOID, so the lookup still catches it
```

---

## 10. Error handling principles

- Every hardware operation (NFC write, print job) is followed by a verification read/scan before the state machine advances — never trust "operation succeeded" from the hardware alone.
- Failures produce a specific, named failure state (e.g. `NFC_ENCODING_FAILED`, `PRINT_FAILED`) logged as an event, not a generic error — this is what makes a failed card's history reconstructable later.
- On app restart after a crash mid-issuance, resume from the card's last confirmed status rather than restarting the whole flow — don't re-encode a card that's already `NFC_VERIFIED`.
- Operator-facing error messages should be actionable ("check ribbon/card stock/connection"), not raw SDK error codes.

---

## 11. Roles

- **Operator** — creates/issues cards, performs check-in
- **Administrator** — manages templates, printers/readers, voids cards, manages users
- **Auditor** — read-only access to card events/history

---

## 12. Single-station vs multi-station

**Single station (MVP):** everything local — local database, local hardware, no network dependency.

**Multiple stations:** move card allocation, patient records, and audit logging behind a shared backend so two desks can't issue conflicting `card_id`s or race on the same patient record. Each station keeps hardware adapters local; only data operations move to the shared backend. The printer- and reader-agnostic design (§4) is unaffected — this layer sits entirely on the data side.

---

## 13. Packaging notes (vendor-neutral)

- Card printers of this class almost universally install as a standard OS print driver — the app doesn't need to bundle any vendor's software; the driver installs separately on the station machine, and the app targets "whichever card printer is registered."
- PC/SC NFC readers are handled through a standard OS-level service, similarly vendor-neutral at the packaging level.
- Vendor choice only surfaces in the shipped app if an SDK-level printer adapter is added later (§4) — that adapter, and only that adapter, becomes vendor-specific.

---

## 14. Build phases

**Phase 1 — Single-station MVP:** one card type, one template, driver-level printing, NTAG-tier NFC, local database. Goal: reliably issue and check in a card end-to-end.

**Phase 2 — Hardening:** resumable issuance after crashes, operator-facing error states, lost/reissue flow, roles/permissions.

**Phase 3 — Multi-station:** shared backend, central card allocation, centralized audit log.

**Phase 4 — Optional upgrades:** SDK-level printer integration (if driver-level status feedback proves insufficient), authenticated-tier NFC (if duplication risk or unattended kiosks become real requirements).

---

## 15. Open decisions before building

1. **Driver-level vs SDK-level printer integration** to start with — recommend driver-level first
2. **Basic-tag vs authenticated-chip NFC** — depends on whether unattended/kiosk check-in is on the roadmap
3. **Where the originality-code signing key is held and rotated**
4. **EMR link format** — `hospital_no` vs a separate EMR-specific ID in the QR
5. **Single-station pilot vs multi-station from day one** — determines whether the backend/sync layer (§12) is needed immediately or deferred

---

## Appendix — NFC terminology quick reference

- **NFC-A / ISO 14443A** — the radio-layer standard nearly all these chips (basic and authenticated tiers alike) use
- **ISO-DEP (ISO 14443-4)** — the command/response transport layer authenticated-tier chips use; basic tags don't implement it
- **NDEF** — the standard data format for simple tag read/write
- **Basic tag tier (e.g. NTAG21x)** — no real authentication, cheap, fine when a human verification step already backstops the check-in
- **Authenticated tier (e.g. MIFARE DESFire)** — AES-based mutual authentication, application/file structure, meaningfully more expensive and requires key management — reserved for unsupervised/high-stakes check-in paths
