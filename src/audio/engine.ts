import type { Arrangement } from '../core/ir';
import { frequencyOf, type PitchId, type PitchSpec } from '../core/pitches';
import { buildSchedule, type ScheduledNote } from '../core/schedule';
import { VOICE, releaseForGap } from './voice-model';

interface Voice {
  readonly ctx: AudioContext;
  readonly gain: GainNode;
  readonly fundamental: OscillatorNode;
  readonly overtone: OscillatorNode;
  readonly third: OscillatorNode;
}

const {
  attack: ATTACK,
  decay: DECAY,
  peak: PEAK,
  sustain: SUSTAIN,
  release: RELEASE,
  minAudible: MIN_AUDIBLE,
  master: MASTER_GAIN,
  overtoneGain: OVERTONE_GAIN,
  thirdGain: THIRD_GAIN,
} = VOICE;

/**
 * Oscillator-based ocarina voice with a damped delay. Live notes share one
 * voice; scheduled notes use separate voices. Timing uses the AudioContext clock.
 */
export class OcarinaEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private live: Voice | null = null;
  private livePitch: PitchId | null = null;
  private scheduled: Voice[] = [];
  private timer: number | null = null;
  private generation = 0;
  private pending = false;
  private playback: ScheduledNote[] = [];
  private playbackEnd = 0;

  /** Creates the audio graph lazily; browsers only allow it after a gesture. */
  private ensure(): { ctx: AudioContext; master: GainNode } {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);

      // Short damped delay: a small room, with no broadband noise tail.
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.085;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.22;
      const damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 2400;
      const wet = ctx.createGain();
      wet.gain.value = 0.18;

      master.connect(delay);
      delay.connect(damp);
      damp.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(ctx.destination);

      this.ctx = ctx;
      this.master = master;
    }

    const { ctx, master } = this;
    if (!master) throw new Error('Audio graph missing');
    return { ctx, master };
  }

  /** Live key press. Retune an existing voice without restarting its envelope. */
  noteOn(pitch: PitchSpec, bend = 0): void {
    if (this.live) {
      this.livePitch = pitch.id;
      this.setBend(bend);
      return;
    }
    const { ctx, master } = this.ensure();
    if (ctx.state === 'suspended') void ctx.resume();
    this.livePitch = pitch.id;
    this.live = this.createVoice(ctx, master, frequencyOf(pitch.id, bend), ctx.currentTime);
  }

  /** Bends the sounding note. `glide` in seconds: 0 is an instant step. */
  setBend(semitones: number, glide = 0): void {
    const voice = this.live;
    if (!voice || !this.livePitch) return;

    const hz = frequencyOf(this.livePitch, semitones);
    const now = voice.ctx.currentTime;
    const params = [
      voice.fundamental.frequency,
      voice.overtone.frequency,
      voice.third.frequency,
    ];
    const targets = [hz, hz * 2, hz * 3];

    for (let index = 0; index < params.length; index += 1) {
      const param = params[index];
      const target = targets[index];
      if (!param || target === undefined) continue;

      param.cancelScheduledValues(now);

      if (glide > 0) {
        // Linear, not exponential: an asymptotic curve reads as a synth slide.
        param.setValueAtTime(param.value, now);
        param.linearRampToValueAtTime(target, now + glide);
      } else {
        param.setValueAtTime(target, now);
      }
    }
  }

  noteOff(): void {
    this.stopLive();
  }

  /** Resolves to the absolute AudioContext end time, or zero if cancelled. */
  async play(arrangement: Arrangement): Promise<number> {
    this.stopAll();
    if (arrangement.notes.length === 0) return 0;
    const generation = this.generation;
    const { ctx, master } = this.ensure();
    this.pending = true;
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      if (generation !== this.generation) return 0;
      const schedule = buildSchedule(arrangement.notes, arrangement.tempoBpm, ctx.currentTime + 0.01);
      this.playback = schedule;
      this.playbackEnd = Math.max(...schedule.map(note => note.startTime + note.duration)) + RELEASE;
      this.pending = false;
      let cursor = 0;
      const pump = (): void => {
        const horizon = ctx.currentTime + 1.5;
        while (cursor < schedule.length) {
          const note = schedule[cursor];
          if (!note || note.startTime > horizon) break;
          cursor += 1;
          const gap = (schedule[cursor]?.startTime ?? Infinity) - note.startTime - note.duration;
          this.scheduled.push(this.createVoice(ctx, master, frequencyOf(note.pitch, note.bend), note.startTime, note.duration, releaseForGap(gap)));
        }
        if (cursor >= schedule.length) this.clearTimer();
      };
      this.timer = window.setInterval(pump, 250);
      pump();
      return this.playbackEnd;
    } catch (error) {
      if (generation === this.generation) this.stopAll();
      throw error;
    }
  }

  getPlaybackState(): { playing: boolean; noteIndex: number | null } {
    if (this.pending) return { playing: true, noteIndex: null };
    const now = this.ctx?.currentTime;
    if (now === undefined || now >= this.playbackEnd || !this.playback.length) {
      return { playing: false, noteIndex: null };
    }
    const note = this.playback.find(item => now >= item.startTime && now < item.startTime + item.duration);
    return { playing: true, noteIndex: note?.noteIndex ?? null };
  }

  stopAll(): void {
    this.generation += 1;
    this.pending = false;
    this.playback = [];
    this.playbackEnd = 0;
    this.clearTimer();
    for (const voice of this.scheduled) this.release(voice);
    this.scheduled = [];
    this.stopLive();
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    window.clearInterval(this.timer);
    this.timer = null;
  }

  private stopLive(): void {
    if (!this.live) return;
    const voice = this.live;
    this.live = null;
    this.release(voice);
  }

  private release(voice: Voice, at?: number): void {
    const time = at ?? voice.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(time);
    voice.gain.gain.setTargetAtTime(0.0001, time, 0.06);
    for (const oscillator of [voice.fundamental, voice.overtone, voice.third]) {
      oscillator.stop(time + 0.25);
    }
  }

  private createVoice(
    ctx: AudioContext,
    destination: AudioNode,
    hz: number,
    start: number,
    duration?: number,
    releaseDuration: number = RELEASE,
  ): Voice {
    const gain = ctx.createGain();
    const fundamental = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    const third = ctx.createOscillator();
    const thirdGain = ctx.createGain();

    fundamental.type = 'sine';
    overtone.type = 'triangle';
    overtoneGain.gain.value = OVERTONE_GAIN;
    third.type = 'sine';
    thirdGain.gain.value = THIRD_GAIN;

    fundamental.frequency.setValueAtTime(hz, start);
    overtone.frequency.setValueAtTime(hz * 2, start);
    third.frequency.setValueAtTime(hz * 3, start);

    fundamental.connect(gain);
    overtone.connect(overtoneGain);
    overtoneGain.connect(gain);
    third.connect(thirdGain);
    thirdGain.connect(gain);
    gain.connect(destination);

    gain.gain.setValueAtTime(0.0001, start);
    const envelopeDuration = duration === undefined ? Infinity : Math.max(duration, MIN_AUDIBLE);
    gain.gain.linearRampToValueAtTime(PEAK, start + Math.min(ATTACK, envelopeDuration));
    gain.gain.linearRampToValueAtTime(SUSTAIN, start + Math.min(ATTACK + DECAY, envelopeDuration));

    fundamental.start(start);
    overtone.start(start);
    third.start(start);

    if (duration !== undefined) {
      const end = start + Math.max(duration, MIN_AUDIBLE);
      gain.gain.setValueAtTime(SUSTAIN, end);
      gain.gain.exponentialRampToValueAtTime(0.0001, end + releaseDuration);
      fundamental.stop(end + releaseDuration + 0.02);
      overtone.stop(end + releaseDuration + 0.02);
      third.stop(end + releaseDuration + 0.02);
    }

    fundamental.addEventListener(
      'ended',
      () => {
        gain.disconnect();
        overtoneGain.disconnect();
        thirdGain.disconnect();
      },
      { once: true },
    );

    return { ctx, gain, fundamental, overtone, third };
  }
}
