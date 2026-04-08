// ─── mulaw decode table ───
const MULAW_DECODE = new Int16Array(256);
(function buildMulawTable() {
  for (let i = 0; i < 256; i++) {
    let mu = ~i & 0xff;
    let sign = mu & 0x80 ? -1 : 1;
    mu = mu & 0x7f;
    let exponent = (mu >> 4) & 0x07;
    let mantissa = mu & 0x0f;
    let sample = ((mantissa << 1) + 33) << (exponent + 2);
    sample -= 0x84;
    MULAW_DECODE[i] = sign * sample;
  }
})();

// PCM Linear to mulaw
function linearToMulaw(sample) {
  const MULAW_MAX = 0x1fff;
  const MULAW_BIAS = 33;
  const sign = sample < 0 ? 0x80 : 0;
  if (sample < 0) sample = -sample;
  if (sample > MULAW_MAX) sample = MULAW_MAX;
  sample += MULAW_BIAS;
  let exponent = 7;
  const expMask = 0x4000;
  for (; exponent > 0; exponent--) {
    if (sample & expMask) break;
    sample <<= 1;
  }
  const mantissa = (sample >> 10) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

// Decode Twilio mulaw 8kHz base64 → PCM Int16 8kHz
function decodeMulaw(base64Data) {
  const buf = Buffer.from(base64Data, "base64");
  const pcm = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    pcm[i] = MULAW_DECODE[buf[i]];
  }
  return pcm;
}

// Simple upsampling 8kHz → 16kHz (linear interpolation)
function upsample8to16(pcm8k) {
  const pcm16k = new Int16Array(pcm8k.length * 2);
  for (let i = 0; i < pcm8k.length; i++) {
    pcm16k[i * 2] = pcm8k[i];
    const next = i + 1 < pcm8k.length ? pcm8k[i + 1] : pcm8k[i];
    pcm16k[i * 2 + 1] = Math.round((pcm8k[i] + next) / 2);
  }
  return pcm16k;
}

// Downsample 24kHz → 8kHz (take every 3rd sample)
function downsample24to8(pcm24k) {
  const pcm8k = new Int16Array(Math.floor(pcm24k.length / 3));
  for (let i = 0; i < pcm8k.length; i++) {
    pcm8k[i] = pcm24k[i * 3];
  }
  return pcm8k;
}

// Encode PCM Int16 → mulaw bytes → base64
function encodeToMulaw(pcm16) {
  const mulaw = Buffer.alloc(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    mulaw[i] = linearToMulaw(pcm16[i]);
  }
  return mulaw.toString("base64");
}

// PCM Int16 → base64 for Gemini (little-endian)
function int16ToBase64(int16Array) {
  const buf = Buffer.from(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
  return buf.toString("base64");
}

// Decode Gemini PCM base64 → Int16
function base64ToInt16(base64) {
  const buf = Buffer.from(base64, "base64");
  return new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
}

module.exports = {
  decodeMulaw,
  upsample8to16,
  downsample24to8,
  encodeToMulaw,
  int16ToBase64,
  base64ToInt16,
};
