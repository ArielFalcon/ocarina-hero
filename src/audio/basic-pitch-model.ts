/** onnxruntime adapter for the Basic Pitch model; the browser loader keeps the runtime out of the initial bundle. */
import type { InferenceSession, Tensor } from 'onnxruntime-web';
import { BASIC_PITCH_WINDOW_SAMPLES, type BasicPitchModel } from '../core/basic-pitch';

/** sha256 of public/models/basic-pitch-nmp.onnx (spotify/basic-pitch v0.4.0, saved_models/icassp_2022/nmp.onnx). */
export const BASIC_PITCH_MODEL_SHA256 = '2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec';
const INPUT = 'serving_default_input_2:0';
const NOTES = 'StatefulPartitionedCall:1';
const ONSETS = 'StatefulPartitionedCall:2';

/** The parts of an onnxruntime module (web or node build) this adapter uses. */
export interface OnnxRuntime {
  readonly InferenceSession: { create(model: Uint8Array): Promise<InferenceSession> };
  readonly Tensor: new (type: 'float32', data: Float32Array, dims: readonly number[]) => Tensor;
}

export async function createBasicPitchModel(runtime: OnnxRuntime, model: Uint8Array): Promise<BasicPitchModel> {
  const session = await runtime.InferenceSession.create(model);
  return async (window) => {
    const input = new runtime.Tensor('float32', window, [1, BASIC_PITCH_WINDOW_SAMPLES, 1]);
    const output = await session.run({ [INPUT]: input }, [NOTES, ONSETS]);
    return { notes: output[NOTES]!.data as Float32Array, onsets: output[ONSETS]!.data as Float32Array };
  };
}

let browserModel: Promise<BasicPitchModel> | undefined;

/** Loads the WebAssembly runtime and model once per page; a failed load is retried on the next call. */
export function loadBrowserBasicPitch(): Promise<BasicPitchModel> {
  browserModel ??= (async () => {
    const [runtime, wasm] = await Promise.all([
      import('onnxruntime-web/wasm'),
      import('onnxruntime-web/ort-wasm-simd-threaded.wasm?url').then(module => module.default as string),
    ]);
    runtime.env.wasm.wasmPaths = { wasm };
    const response = await fetch(`${import.meta.env.BASE_URL}models/basic-pitch-nmp.onnx`);
    if (!response.ok) throw new Error(`model download failed (HTTP ${response.status})`);
    return createBasicPitchModel(runtime, new Uint8Array(await response.arrayBuffer()));
  })().catch(error => { browserModel = undefined; throw error; });
  return browserModel;
}
