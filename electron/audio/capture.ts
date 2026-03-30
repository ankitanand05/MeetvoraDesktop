/**
 * Audio Capture Module — Cross-Platform
 *
 * Captures system audio using FFmpeg with platform-specific backends:
 *   Windows: WASAPI loopback (no virtual device required)
 *   macOS:   AVFoundation (requires BlackHole or similar virtual device)
 *   Linux:   PulseAudio monitor source
 *
 * Flow:
 *   System Audio → Platform Backend → FFmpeg → Raw PCM → Buffer → WAV Chunk → Callback
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { app } from 'electron';
import os from 'os';

export interface AudioCaptureOptions {
  chunkDurationMs: number;
  sampleRate: number;
  channels: number;
  onAudioChunk: (wavBuffer: Buffer) => void;
  onError: (error: Error) => void;
}

function createWavHeader(
  pcmDataLength: number,
  sampleRate: number,
  channels: number,
  bitsPerSample: number = 16
): Buffer {

  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(pcmDataLength + 36, 4);
  header.write('WAVE', 8);

  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  header.write('data', 36);
  header.writeUInt32LE(pcmDataLength, 40);

  return header;
}

function pcmToWav(pcmBuffer: Buffer, sampleRate: number, channels: number): Buffer {
  const header = createWavHeader(pcmBuffer.length, sampleRate, channels);
  return Buffer.concat([header, pcmBuffer]);
}

function hasAudioContent(pcmBuffer: Buffer, threshold: number = 500): boolean {
  if (pcmBuffer.length < 2) return false;

  let sumSquares = 0;
  const sampleCount = pcmBuffer.length / 2;

  for (let i = 0; i < pcmBuffer.length - 1; i += 2) {
    const sample = pcmBuffer.readInt16LE(i);
    sumSquares += sample * sample;
  }

  const rms = Math.sqrt(sumSquares / sampleCount);
  return rms > threshold;
}

/**
 * Build platform-specific FFmpeg arguments for system audio capture.
 */
function buildFFmpegArgs(sampleRate: number, channels: number): string[] {
  const platform = os.platform();

  switch (platform) {
    case 'win32':
      // WASAPI loopback — captures default output device
      return [
        '-f', 'wasapi',
        '-i', 'default',
        '-ac', String(channels),
        '-ar', String(sampleRate),
        '-f', 's16le',
        '-acodec', 'pcm_s16le',
        '-fflags', '+nobuffer',
        '-loglevel', 'error',
        'pipe:1',
      ];

    case 'darwin':
      // AVFoundation — captures from audio device index 0
      // Requires a virtual audio device like BlackHole for system audio
      return [
        '-f', 'avfoundation',
        '-i', ':0',
        '-ac', String(channels),
        '-ar', String(sampleRate),
        '-f', 's16le',
        '-acodec', 'pcm_s16le',
        '-fflags', '+nobuffer',
        '-loglevel', 'error',
        'pipe:1',
      ];

    case 'linux':
      // PulseAudio monitor source — captures system output
      return [
        '-f', 'pulse',
        '-i', 'default',
        '-ac', String(channels),
        '-ar', String(sampleRate),
        '-f', 's16le',
        '-acodec', 'pcm_s16le',
        '-fflags', '+nobuffer',
        '-loglevel', 'error',
        'pipe:1',
      ];

    default:
      throw new Error(`Unsupported platform for audio capture: ${platform}`);
  }
}

export class AudioCapture {

  private options: AudioCaptureOptions;
  private ffmpegProcess: ChildProcess | null = null;
  private pcmBuffer: Buffer = Buffer.alloc(0);
  private chunkTimer: NodeJS.Timeout | null = null;
  private isCapturing: boolean = false;

  constructor(options: AudioCaptureOptions) {
    this.options = {
      chunkDurationMs: options.chunkDurationMs || 5000,
      sampleRate: options.sampleRate || 16000,
      channels: options.channels || 1,
      onAudioChunk: options.onAudioChunk,
      onError: options.onError,
    };
  }

  async start(): Promise<void> {

    if (this.isCapturing) {
      throw new Error('Audio capture is already running');
    }

    this.isCapturing = true;
    this.pcmBuffer = Buffer.alloc(0);

    const ffmpegPath = this.getFFmpegPath();
    const args = buildFFmpegArgs(this.options.sampleRate, this.options.channels);

    try {
      this.ffmpegProcess = spawn(ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.ffmpegProcess.stdout?.on('data', (data: Buffer) => {
        this.pcmBuffer = Buffer.concat([this.pcmBuffer, data]);
      });

      this.ffmpegProcess.stderr?.on('data', (data: Buffer) => {
        console.error('[FFmpeg]', data.toString());
      });

      this.ffmpegProcess.on('close', (code) => {
        if (code !== 0 && this.isCapturing) {
          this.options.onError(new Error(`FFmpeg exited with code ${code}`));
        }
        this.isCapturing = false;
      });

      this.ffmpegProcess.on('error', (error) => {
        this.options.onError(
          new Error(`FFmpeg failed to start: ${error.message}`)
        );
        this.isCapturing = false;
      });

      this.startChunkTimer();
      console.log(`[AudioCapture] Started (${os.platform()} backend)`);

    } catch (error: any) {
      this.isCapturing = false;
      throw new Error(`Failed to start audio capture: ${error.message}`);
    }
  }

  async stop(): Promise<void> {

    this.isCapturing = false;

    if (this.chunkTimer) {
      clearInterval(this.chunkTimer);
      this.chunkTimer = null;
    }

    this.flushBuffer();

    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      setTimeout(() => {
        if (this.ffmpegProcess && !this.ffmpegProcess.killed) {
          this.ffmpegProcess.kill('SIGKILL');
        }
        this.ffmpegProcess = null;
      }, 2000);
    }

    this.pcmBuffer = Buffer.alloc(0);
    console.log('[AudioCapture] Stopped');
  }

  private startChunkTimer(): void {
    this.chunkTimer = setInterval(() => {
      this.flushBuffer();
    }, this.options.chunkDurationMs);
  }

  private flushBuffer(): void {

    if (this.pcmBuffer.length === 0) return;

    const currentBuffer = this.pcmBuffer;
    this.pcmBuffer = Buffer.alloc(0);

    if (!hasAudioContent(currentBuffer)) {
      return;
    }

    const wavBuffer = pcmToWav(
      currentBuffer,
      this.options.sampleRate,
      this.options.channels
    );

    try {
      this.options.onAudioChunk(wavBuffer);
    } catch (error: any) {
      console.error('[AudioCapture] Callback error:', error);
    }
  }

  /**
   * Get the FFmpeg binary path — platform-aware.
   * In development: uses system-installed ffmpeg.
   * In production: uses bundled ffmpeg from app resources.
   */
  private getFFmpegPath(): string {
    if (app.isPackaged) {
      const platform = os.platform();
      const binaryName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
      return path.join(process.resourcesPath, 'ffmpeg', binaryName);
    }
    return 'ffmpeg';
  }

  get isActive(): boolean {
    return this.isCapturing;
  }
}
