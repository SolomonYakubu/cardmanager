// Ambient declaration for nfc-pcsc, which ships no TypeScript types.
//
// We declare only enough for the dynamic import in the hardware resolver to
// type-check; the real structural contract lives in pcsc-nfc-adapter.ts
// (NfcLib), and the resolver casts this export to it.
declare module 'nfc-pcsc' {
  export const NFC: unknown
}
