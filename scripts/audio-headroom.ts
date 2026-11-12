export function applyHeadroom(samples: Float32Array): void {
  const ceiling = 0.95;
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak <= ceiling) return;
  const gain = ceiling / peak;
  for (let index = 0; index < samples.length; index++) samples[index] = samples[index]! * gain;
}
