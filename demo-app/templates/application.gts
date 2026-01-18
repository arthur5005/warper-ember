import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { modifier } from 'ember-modifier';
import { pageTitle } from 'ember-page-title';
import { htmlSafe } from '@ember/template';
import { WarperComponent } from '@arthur5005/warper-ember';
import type { TOC } from '@ember/component/template-only';

const eq = (a: unknown, b: unknown) => a === b;

// ============================================================================
// DATA GENERATION
// ============================================================================

function generateHash(index: number): string {
  const chars = '0123456789abcdef';
  let hash = '0x';
  const seed = index * 2654435761;
  for (let i = 0; i < 16; i++) {
    hash += chars[(seed * (i + 1) * 7) % 16];
  }
  return hash;
}

function generateTimestamp(index: number): string {
  const base = Date.now() - index * 1000;
  const date = new Date(base);
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

const statuses = ['confirmed', 'pending', 'failed'] as const;
const types = ['transfer', 'swap', 'stake', 'mint', 'burn', 'bridge'] as const;

interface Transaction {
  index: number;
  hash: string;
  timestamp: string;
  type: string;
  status: string;
  amount: number;
  gas: number;
}

function generateTransaction(index: number): Transaction {
  return {
    index,
    hash: generateHash(index),
    timestamp: generateTimestamp(index),
    type: types[index % types.length]!,
    status: statuses[index % statuses.length]!,
    amount: ((index * 137) % 100000) / 100,
    gas: ((index * 31) % 50000) + 21000,
  };
}

const TYPE_COLORS: Record<string, string> = {
  transfer: '#3b82f6',
  swap: '#a855f7',
  stake: '#00d4aa',
  mint: '#22c55e',
  burn: '#ef4444',
  bridge: '#f97316',
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#00d4aa',
  pending: '#eab308',
  failed: '#ef4444',
};

// ============================================================================
// PERFORMANCE MONITOR - Direct DOM updates, bypasses Glimmer for max perf
// ============================================================================

const SAMPLE_SIZE = 30;
const JANK_THRESHOLD = 50;

/**
 * High-performance FPS monitor that updates DOM directly.
 * No @tracked properties = no Glimmer render cycles during measurement.
 */
class PerformanceMonitor extends Component {
  // All state is private, non-reactive - we update DOM directly
  private frameTimes = new Float64Array(SAMPLE_SIZE);
  private frameIndex = 0;
  private frameCount = 0;
  private lastFrameTime = performance.now();
  private rafId = 0;
  private updateCounter = 0;
  private jankCount = 0;
  private targetFps = 120;

  // DOM element refs - grabbed once, updated directly
  private els: {
    fps: HTMLElement | null;
    avg: HTMLElement | null;
    min: HTMLElement | null;
    max: HTMLElement | null;
    ft: HTMLElement | null;
    jank: HTMLElement | null;
    target: HTMLElement | null;
    canvas: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null;
  } = {
    fps: null,
    avg: null,
    min: null,
    max: null,
    ft: null,
    jank: null,
    target: null,
    canvas: null,
    ctx: null,
  };

  // Circular buffer for FPS history (matches React's 120-point history)
  private fpsHistory = new Float64Array(120);
  private historyIndex = 0;
  private historyCount = 0;
  private maxHistorySize = 120;

  private getFpsColor(fps: number): string {
    const ratio = fps / this.targetFps;
    if (ratio >= 0.95) return '#00d4aa';
    if (ratio >= 0.75) return '#eab308';
    return '#ef4444';
  }

  private detectRefreshRate(targetEl: HTMLElement | null): void {
    const times: number[] = [];
    let detected = false;

    const detect = (now: number) => {
      if (detected) return;

      times.push(now);
      if (times.length > 60) {
        const diffs = times.slice(1).map((t, i) => t - times[i]!);
        const avg = diffs.reduce((a, b) => a + b) / diffs.length;
        const hz = Math.round(1000 / avg);

        // Round to common refresh rates
        if (hz >= 200) this.targetFps = 240;
        else if (hz >= 155) this.targetFps = 165;
        else if (hz >= 135) this.targetFps = 144;
        else if (hz >= 100) this.targetFps = 120;
        else if (hz >= 80) this.targetFps = 90;
        else if (hz >= 65) this.targetFps = 75;
        else this.targetFps = 60;

        // Direct DOM update
        if (targetEl) targetEl.textContent = `${this.targetFps}Hz`;
        detected = true;
        return;
      }
      requestAnimationFrame(detect);
    };

    requestAnimationFrame(detect);
  }

  private drawGraph(fps: number): void {
    const { ctx, canvas } = this.els;
    if (!ctx || !canvas) return;

    // Add to circular buffer
    this.fpsHistory[this.historyIndex] = fps;
    this.historyIndex = (this.historyIndex + 1) % this.maxHistorySize;
    if (this.historyCount < this.maxHistorySize) this.historyCount++;

    // Handle devicePixelRatio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#1a1a24';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Graph max is 25% above target for headroom visualization
    const graphMax = Math.round(this.targetFps * 1.25);

    // Draw FPS history from circular buffer (oldest to newest)
    if (this.historyCount > 1) {
      ctx.beginPath();
      const step = width / (this.maxHistorySize - 1);
      const startIdx = this.historyIndex; // Oldest entry is at current index

      for (let i = 0; i < this.historyCount; i++) {
        const bufIdx = (startIdx + i) % this.maxHistorySize;
        const x = i * step;
        const fpsVal = Math.min(this.fpsHistory[bufIdx]!, graphMax);
        const y = height - (fpsVal / graphMax) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.strokeStyle = '#00d4aa';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Fill under curve
      ctx.lineTo((this.historyCount - 1) * step, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 212, 170, 0.1)';
      ctx.fill();
    }

    // Target FPS line (dashed)
    const targetY = height - (this.targetFps / graphMax) * height;
    ctx.strokeStyle = '#00d4aa40';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, targetY);
    ctx.lineTo(width, targetY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  setupMonitor = modifier((element: HTMLElement) => {
    // Grab all DOM refs once
    const canvas = element.querySelector('canvas') as HTMLCanvasElement;
    this.els = {
      fps: element.querySelector('[data-fps]'),
      avg: element.querySelector('[data-avg]'),
      min: element.querySelector('[data-min]'),
      max: element.querySelector('[data-max]'),
      ft: element.querySelector('[data-ft]'),
      jank: element.querySelector('[data-jank]'),
      target: element.querySelector('[data-target]'),
      canvas,
      ctx: canvas?.getContext('2d') ?? null,
    };

    this.detectRefreshRate(this.els.target);

    const measure = () => {
      const now = performance.now();
      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;

      if (delta > 0 && delta < 1000) {
        // Record frame time in circular buffer
        this.frameTimes[this.frameIndex] = delta;
        this.frameIndex = (this.frameIndex + 1) % SAMPLE_SIZE;
        if (this.frameCount < SAMPLE_SIZE) this.frameCount++;

        if (delta > JANK_THRESHOLD) {
          this.jankCount++;
        }

        // Update every 3 frames
        this.updateCounter++;
        if (this.updateCounter >= 3 && this.frameCount > 0) {
          this.updateCounter = 0;

          // Calculate stats from circular buffer
          let sum = 0;
          let minTime = this.frameTimes[0]!;
          let maxTime = this.frameTimes[0]!;
          for (let i = 0; i < this.frameCount; i++) {
            const t = this.frameTimes[i]!;
            sum += t;
            if (t < minTime) minTime = t;
            if (t > maxTime) maxTime = t;
          }

          const fps = Math.round(1000 / delta);
          const avgFps = Math.round(1000 / (sum / this.frameCount));
          const minFps = Math.round(1000 / maxTime);
          const maxFps = Math.min(999, Math.round(1000 / minTime));
          const frameTime = Math.round(delta * 100) / 100;

          // Direct DOM updates - NO Glimmer involvement for perf reasons
          const { els } = this;
          if (els.fps) {
            els.fps.textContent = String(fps);
            els.fps.style.color = this.getFpsColor(fps);
          }
          if (els.avg) els.avg.textContent = String(avgFps);
          if (els.min) els.min.textContent = String(minFps);
          if (els.max) els.max.textContent = String(maxFps);
          if (els.ft) els.ft.textContent = `${frameTime}ms`;
          if (els.jank) {
            els.jank.textContent = String(this.jankCount);
            els.jank.classList.toggle('stat-jank', this.jankCount > 0);
          }

          // Draw FPS graph
          this.drawGraph(fps);
        }
      }

      this.rafId = requestAnimationFrame(measure);
    };

    this.rafId = requestAnimationFrame(measure);

    return () => {
      cancelAnimationFrame(this.rafId);
    };
  });

  <template>
    <div {{this.setupMonitor}} class="perf-monitor">
      <canvas class="perf-canvas" width="120" height="40"></canvas>
      <div class="perf-fps">
        <span class="perf-fps-value" data-fps>0</span>
        <span class="perf-fps-label">fps</span>
      </div>
      <div class="perf-stats">
        <div class="perf-stat">
          <span class="stat-label">avg</span>
          <span class="stat-value" data-avg>0</span>
        </div>
        <div class="perf-stat">
          <span class="stat-label">min</span>
          <span class="stat-value stat-min" data-min>0</span>
        </div>
        <div class="perf-stat">
          <span class="stat-label">max</span>
          <span class="stat-value stat-max" data-max>0</span>
        </div>
        <div class="perf-stat">
          <span class="stat-label">ft</span>
          <span class="stat-value" data-ft>0ms</span>
        </div>
        <div class="perf-stat">
          <span class="stat-label">jank</span>
          <span class="stat-value" data-jank>0</span>
        </div>
        <div class="perf-stat">
          <span class="stat-hz">@</span>
          <span class="stat-value stat-target" data-target>120Hz</span>
        </div>
      </div>
    </div>
  </template>
}

// ============================================================================
// TRANSACTION ROW
// ============================================================================

function typeStyle(tx: Transaction) {
  return htmlSafe(`color:${TYPE_COLORS[tx.type] ?? '#71717a'};`);
}

function statusDotStyle(tx: Transaction) {
  return htmlSafe(`background:${STATUS_COLORS[tx.status] ?? '#71717a'};`);
}

const TransactionRow: TOC<{
  Args: { index: number };
  Element: HTMLDivElement;
}> = <template>
  {{#let (generateTransaction @index) as |tx|}}
    <div class="tx-row" ...attributes>
      <div class="tx-cell tx-index">{{tx.index}}</div>
      <div class="tx-cell tx-hash">{{tx.hash}}</div>
      <div class="tx-cell tx-timestamp">{{tx.timestamp}}</div>
      <div class="tx-cell tx-type" style={{typeStyle tx}}>{{tx.type}}</div>
      <div class="tx-cell tx-status">
        <span class="status-dot" style={{statusDotStyle tx}}></span>
        {{tx.status}}
      </div>
      <div class="tx-cell tx-amount">{{tx.amount}} ETH</div>
      <div class="tx-cell tx-gas">{{tx.gas}}</div>
    </div>
  {{/let}}
</template>;

// ============================================================================
// MAIN STRESS TEST
// ============================================================================

type ScrollPattern = 'smooth' | 'jump' | 'random' | 'bounce';

const ROW_HEIGHT = 38;

class StressTest extends Component {
  @tracked rowCount = 1_000_000;
  @tracked rowCountInput = '1000000';
  @tracked isAutoScrolling = false;
  @tracked scrollPattern: ScrollPattern = 'smooth';
  @tracked scrollSpeed = 100;

  scrollDirection = 1;
  rafId = 0;
  lastTime = 0;
  scrollElement: HTMLElement | null = null;

  get estimateSize() {
    return () => ROW_HEIGHT;
  }

  get listHeight() {
    return 'calc(100vh - 180px)';
  }

  presets = [
    { label: '100K', value: 100_000 },
    { label: '1M', value: 1_000_000 },
    { label: '5M', value: 5_000_000 },
    { label: '10M', value: 10_000_000 },
  ];

  scrollPatterns: ScrollPattern[] = ['smooth', 'jump', 'random', 'bounce'];

  setRowCount = (value: number) => {
    this.rowCount = value;
    this.rowCountInput = String(value);
  };

  applyRowCount = () => {
    const count = parseInt(this.rowCountInput, 10);
    if (!isNaN(count) && count > 0 && count <= 10_000_000) {
      this.rowCount = count;
    }
  };

  handleInputChange = (event: Event) => {
    this.rowCountInput = (event.target as HTMLInputElement).value;
  };

  handleInputKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      this.applyRowCount();
    }
  };

  handlePatternChange = (event: Event) => {
    this.scrollPattern = (event.target as HTMLSelectElement)
      .value as ScrollPattern;
  };

  toggleAutoScroll = () => {
    this.isAutoScrolling = !this.isAutoScrolling;
    if (this.isAutoScrolling) {
      this.startAutoScroll();
    } else {
      this.stopAutoScroll();
    }
  };

  private startAutoScroll = () => {
    this.lastTime = performance.now();
    this.scrollDirection = 1;

    const scroll = (time: number) => {
      if (!this.isAutoScrolling || !this.scrollElement) return;

      const delta = time - this.lastTime;
      this.lastTime = time;

      const el = this.scrollElement;
      const pixelsPerMs = this.scrollSpeed * 0.5;
      const scrollAmount = pixelsPerMs * delta;
      const maxScroll = el.scrollHeight - el.clientHeight;

      switch (this.scrollPattern) {
        case 'smooth':
          el.scrollTop += scrollAmount * this.scrollDirection;
          if (el.scrollTop >= maxScroll) {
            this.scrollDirection = -1;
          } else if (el.scrollTop <= 0) {
            this.scrollDirection = 1;
          }
          break;

        case 'jump':
          if (Math.random() < 0.02) {
            el.scrollTop = Math.random() * maxScroll;
          }
          break;

        case 'random':
          el.scrollTop += (Math.random() - 0.5) * scrollAmount * 6;
          break;

        case 'bounce':
          el.scrollTop += scrollAmount * this.scrollDirection;
          if (Math.random() < 0.01) {
            this.scrollDirection *= -1;
          }
          if (el.scrollTop >= maxScroll) {
            this.scrollDirection = -1;
          } else if (el.scrollTop <= 0) {
            this.scrollDirection = 1;
          }
          break;
      }

      this.rafId = requestAnimationFrame(scroll);
    };

    this.rafId = requestAnimationFrame(scroll);
  };

  private stopAutoScroll = () => {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  };

  captureScrollElement = modifier((element: HTMLElement) => {
    // Poll for the scroll container since VirtualList may still be loading WASM
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max

    const findContainer = () => {
      const scrollContainer = element.querySelector(
        '[data-warper-container]',
      ) as HTMLElement;

      if (scrollContainer) {
        this.scrollElement = scrollContainer;
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(findContainer, 100);
      }
    };

    findContainer();

    return () => {
      this.stopAutoScroll();
      this.scrollElement = null;
    };
  });

  <template>
    <div class="stress-container">
      <div class="header">
        <div class="title">
          <span class="bracket">[</span>
          stress_test
          <span class="bracket">]</span>
          <span class="row-count">{{this.rowCount}} transactions</span>
        </div>
        <PerformanceMonitor />
      </div>

      <div class="table-header">
        <div class="header-row">
          <div class="tx-cell tx-index">#</div>
          <div class="tx-cell tx-hash">tx_hash</div>
          <div class="tx-cell tx-timestamp">timestamp</div>
          <div class="tx-cell tx-type">type</div>
          <div class="tx-cell tx-status">status</div>
          <div class="tx-cell tx-amount">amount</div>
          <div class="tx-cell tx-gas">gas</div>
        </div>
      </div>

      {{! Virtualized List }}
      <div class="list-container" {{this.captureScrollElement}}>
        <WarperComponent
          @itemCount={{this.rowCount}}
          @estimateSize={{this.estimateSize}}
          @height={{this.listHeight}}
          @overscan={{3}}
          class="tx-list"
          as |item|
        >
          <TransactionRow @index={{item}} />
        </WarperComponent>
      </div>

      {{! Floating Control Panel }}
      <div class="control-panel">
        {{#each this.presets as |preset|}}
          <button
            type="button"
            class="btn {{if (eq this.rowCount preset.value) 'btn-active'}}"
            {{on "click" (fn this.setRowCount preset.value)}}
          >
            {{preset.label}}
          </button>
        {{/each}}

        <div class="divider"></div>

        <div class="control-group">
          <span class="control-label">rows</span>
          {{! template-lint-disable require-input-label}}
          <input
            type="text"
            class="control-input"
            value={{this.rowCountInput}}
            {{on "input" this.handleInputChange}}
            {{on "keydown" this.handleInputKeydown}}
            {{on "blur" this.applyRowCount}}
          />
        </div>

        {{! template-lint-disable require-input-label}}
        <select class="control-select" {{on "change" this.handlePatternChange}}>
          {{#each this.scrollPatterns as |pattern|}}
            <option
              value={{pattern}}
              selected={{eq this.scrollPattern pattern}}
            >
              {{pattern}}
            </option>
          {{/each}}
        </select>

        <button
          type="button"
          class="btn {{if this.isAutoScrolling 'btn-active'}}"
          {{on "click" this.toggleAutoScroll}}
        >
          {{if this.isAutoScrolling "■ stop" "▶ run"}}
        </button>
      </div>
    </div>
  </template>
}

<template>
  {{pageTitle "WARPER - Stress Test"}}
  <StressTest />
</template>
