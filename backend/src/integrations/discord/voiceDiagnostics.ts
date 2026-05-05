import { generateDependencyReport } from '@discordjs/voice'

export function logDependencyReport() {
  console.log('--- @discordjs/voice generateDependencyReport ---')
  console.log(generateDependencyReport())
  console.log('--- end report ---')
}

// Stéréo 16-bit interleaved → mono 16-bit, moyenne L/R
export function downmixStereoToMono(stereo: Buffer): Buffer {
  const sampleCount = Math.floor(stereo.length / 4)
  const mono = Buffer.alloc(sampleCount * 2)
  for (let i = 0; i < sampleCount; i++) {
    const l = stereo.readInt16LE(i * 4)
    const r = stereo.readInt16LE(i * 4 + 2)
    mono.writeInt16LE(((l + r) >> 1), i * 2)
  }
  return mono
}

// Détecte les opcodes du voice gateway dans le debug stream pour confirmer que
// l'op 5 Speaking arrive bien (sinon la ssrcMap reste vide → aucun event speaking.start)
export function parseVoiceWsOp(line: string): { direction: string; op: number; raw: string } | null {
  if (!line.includes('[WS]')) return null
  const dirMatch = line.match(/\[WS\]\s*(>>|<<)\s*(\{[\s\S]*?\})/)
  if (!dirMatch) return null
  try {
    const obj = JSON.parse(dirMatch[2])
    if (typeof obj.op === 'number') {
      return { direction: dirMatch[1], op: obj.op, raw: dirMatch[2] }
    }
  } catch {
    // ignore
  }
  return null
}

// Identifie le format d'un buffer audio à partir des premiers octets
export function describeAudioMagic(buf: Buffer): string {
  if (buf.length < 4) return `too small (${buf.length}B)`
  const head = buf.subarray(0, 4)
  const hex = head.toString('hex')
  if (head.toString('ascii', 0, 3) === 'ID3') return `mp3-id3 (${hex})`
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return `mp3-frame (${hex})`
  if (head.toString('ascii', 0, 4) === 'RIFF') return `wav (${hex})`
  if (head.toString('ascii', 0, 4) === 'OggS') return `ogg (${hex})`
  return `unknown (${hex})`
}
