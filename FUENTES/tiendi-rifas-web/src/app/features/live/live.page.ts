import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MyTicket } from '../../core/api/api.models';
import { OrdersApi } from '../../core/api/orders-api';
import { DrawLive } from '../../core/live/draw-live';
import { SessionStore } from '../../core/session/session.store';

interface TombolaBall {
  num: number;
  isMine: boolean;
  isSold: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  extracted: boolean;
}

@Component({
  selector: 'app-live-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './live.page.html',
  styleUrls: ['./live.page.scss'],
})
export class LivePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionStore);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  readonly service = inject(DrawLive);

  @ViewChild('confettiCanvas') confettiCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('tombolaCanvas') tombolaCanvas?: ElementRef<HTMLCanvasElement>;

  readonly raffleId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');
  readonly data = this.service.data;
  readonly phase = this.service.phase;
  readonly checks = this.service.checks;
  readonly localResult = this.service.localResult;
  readonly officialMatch = this.service.officialMatch;
  readonly countdownText = this.service.countdownText;
  readonly spunNumber = this.service.spunNumber;
  readonly failureReason = this.service.failureReason;

  // Multi-attempt and FX signals
  readonly isAdmin = computed(() => this.session.user()?.role?.toLowerCase() === 'admin');
  readonly manualStepMode = this.service.manualStepMode;
  readonly waitingForAdminClick = this.service.waitingForAdminClick;
  readonly selectedEffect = this.service.selectedEffect;
  readonly localSequence = this.service.localSequence;
  readonly currentAttemptIndex = this.service.currentAttemptIndex;
  readonly currentExtraction = this.service.currentExtraction;
  readonly completedExtractions = this.service.completedExtractions;
  readonly betweenAttempts = this.service.betweenAttempts;
  readonly winningAttempt = computed(() => this.data()?.winningAttempt ?? 1);

  // Interactive Board & 5 Effects signals from service
  readonly boardNumbers = this.service.boardNumbers;
  readonly snakeSegments = this.service.snakeSegments;
  readonly radarTargetCell = this.service.radarTargetCell;
  readonly radarLocked = this.service.radarLocked;
  readonly reticlePos = this.service.reticlePos;
  readonly slotDecadeDigit = this.service.slotDecadeDigit;
  readonly slotUnitDigit = this.service.slotUnitDigit;
  readonly slotDecadeLocked = this.service.slotDecadeLocked;
  readonly slotUnitLocked = this.service.slotUnitLocked;
  readonly slotUnitScanCell = this.service.slotUnitScanCell;
  readonly spotlightCell = this.service.spotlightCell;
  readonly tombolaExtractedBall = this.service.tombolaExtractedBall;

  // Logged-in buyer's tickets in this raffle
  readonly myNumbers = signal<number[]>([]);
  readonly myNumbersSet = computed(() => new Set(this.myNumbers()));
  readonly soldNumbersSet = computed(() => new Set(this.data()?.soldNumbers ?? []));
  readonly discardedNumbersSet = computed(
    () =>
      new Set(
        this.completedExtractions()
          .filter((e) => !e.isWinner)
          .map((e) => e.number),
      ),
  );
  readonly winningCellNumber = computed(() =>
    this.phase() === 'result' ? (this.localResult()?.winner ?? null) : null,
  );
  readonly remainingSoldCount = computed(() => {
    const sold = this.data()?.soldNumbers ?? [];
    const disc = this.discardedNumbersSet();
    return Math.max(1, sold.filter((n) => !disc.has(n)).length);
  });

  readonly boardRangeLabel = computed(() => {
    const nums = this.boardNumbers();
    if (nums.length === 0) return '01–30';
    return `${this.padNumber(nums[0])}–${this.padNumber(nums[nums.length - 1])}`;
  });

  readonly showLiveBoard = computed(() => {
    const ph = this.phase();
    return ph === 'spinning' || ph === 'result';
  });

  readonly drawDateFormatted = computed(() => {
    const d = this.data()?.drawAt;
    if (!d) return '';
    return new Intl.DateTimeFormat('es-PE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  });

  readonly truncatedCommitment = computed(() => {
    const hash = this.data()?.commitmentHash;
    return hash ? `${hash.slice(0, 16)}…` : '';
  });

  readonly truncatedSoldListHash = computed(() => {
    const hash = this.data()?.soldListHash;
    return hash ? `${hash.slice(0, 16)}…` : '';
  });

  private tombolaBalls: TombolaBall[] = [];
  private tombolaRafId: number | null = null;
  private tombolaInitializedForRaffle: string | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopTombolaLoop());

    effect(() => {
      const ph = this.phase();
      if (ph === 'result') {
        this.playFanfare();
        setTimeout(() => this.launchConfetti(), 30);
      } else if (ph === 'spinning') {
        this.playTick();
      }
    });

    effect(() => {
      // Trigger subtle audio feedback on spunNumber changes while spinning
      const num = this.spunNumber();
      const ph = this.phase();
      if (
        ph === 'spinning' &&
        !this.betweenAttempts() &&
        !this.waitingForAdminClick() &&
        num !== '000' &&
        num !== '--'
      ) {
        this.playTick();
      }
    });

    effect(() => {
      const eff = this.selectedEffect();
      const ph = this.phase();
      if (eff === 'TOMBOLA' && (ph === 'spinning' || ph === 'result')) {
        setTimeout(() => this.ensureTombolaRunning(), 20);
      } else {
        this.stopTombolaLoop();
      }
    });
  }

  ngOnInit(): void {
    const id = this.raffleId();
    if (id) {
      this.loadBuyerTickets(id);
      void this.service.init(id);
    }
  }

  private loadBuyerTickets(raffleId: string): void {
    try {
      if (!this.session.isAuthenticated()) return;
      const ordersApi = this.injector.get(OrdersApi, null);
      if (!ordersApi?.myTickets) return;
      ordersApi.myTickets().subscribe({
        next: (tickets: MyTicket[]) => {
          const valid = tickets.filter(
            (t) =>
              t.raffleId === raffleId &&
              ['PAID', 'PENDING', 'PENDING_VERIFICATION', 'LATE_PAYMENT_REVIEW'].includes(t.status),
          );
          const nums = [...new Set(valid.flatMap((t) => t.numbers))].sort((a, b) => a - b);
          this.myNumbers.set(nums);
          this.tombolaInitializedForRaffle = null;
        },
        error: () => undefined,
      });
    } catch {
      // Optional in unit tests without HttpClient
    }
  }

  buyerNameFor(ticketNumber: number | string | null | undefined): string | null {
    if (ticketNumber === null || ticketNumber === undefined || ticketNumber === '') return null;
    const num = Number(ticketNumber);
    if (Number.isNaN(num)) return null;
    return this.data()?.soldTicketBuyers?.[num] ?? null;
  }

  padNumber(n: number | string | null | undefined): string {
    if (n === null || n === undefined || n === '') return '--';
    const num = Number(n);
    if (Number.isNaN(num)) return String(n);
    const max = this.data()?.numberMax ?? 30;
    const digits = Math.max(2, String(max).length);
    return String(num).padStart(digits, '0');
  }

  snakeClassFor(n: number): string {
    if (this.selectedEffect() !== 'SNAKE' || this.phase() !== 'spinning' || this.betweenAttempts()) {
      return '';
    }
    const segs = this.snakeSegments();
    const idx = segs.indexOf(n);
    if (idx === 0) return 'snake-head';
    if (idx === 1) return 'snake-body-1';
    if (idx === 2) return 'snake-body-2';
    if (idx === 3) return 'snake-body-3';
    if (idx === 4) return 'snake-body-4';
    return '';
  }

  isRadarPing(n: number): boolean {
    return (
      this.selectedEffect() === 'RADAR' &&
      this.phase() === 'spinning' &&
      !this.betweenAttempts() &&
      this.radarTargetCell() === n
    );
  }

  isSlotDecadeMatch(n: number): boolean {
    return (
      this.selectedEffect() === 'SLOT_MACHINE' &&
      this.phase() === 'spinning' &&
      !this.betweenAttempts() &&
      this.slotDecadeLocked() &&
      Math.floor(n / 10) === Number(this.slotDecadeDigit())
    );
  }

  isSlotDimmed(n: number): boolean {
    return (
      this.selectedEffect() === 'SLOT_MACHINE' &&
      this.phase() === 'spinning' &&
      !this.betweenAttempts() &&
      this.slotDecadeLocked() &&
      Math.floor(n / 10) !== Number(this.slotDecadeDigit())
    );
  }

  isSlotUnitScan(n: number): boolean {
    return (
      this.selectedEffect() === 'SLOT_MACHINE' &&
      this.phase() === 'spinning' &&
      !this.betweenAttempts() &&
      this.slotUnitScanCell() === n
    );
  }

  isSpotlightBeam(n: number): boolean {
    return (
      this.selectedEffect() === 'SUSPENSE_CONFETTI' &&
      this.phase() === 'spinning' &&
      !this.betweenAttempts() &&
      this.spotlightCell() === n
    );
  }

  isActiveMyChip(n: number): boolean {
    if (this.phase() === 'result') {
      return this.localResult()?.winner === n;
    }
    return Number(this.spunNumber()) === n;
  }

  triggerNextStep(): void {
    this.service.triggerNextStep();
  }

  switchToAutoPlay(): void {
    this.service.switchToAutoPlay();
  }

  replayAuto(): void {
    this.tombolaInitializedForRaffle = null;
    void this.service.replay(false);
  }

  replayManual(): void {
    this.tombolaInitializedForRaffle = null;
    void this.service.replay(true);
  }

  replayDraw(): void {
    this.replayAuto();
  }

  private initTombolaBalls(): void {
    const cx = 115;
    const cy = 115;
    const sold = this.data()?.soldNumbers ?? [];
    const board = this.boardNumbers();
    const mySet = this.myNumbersSet();
    const soldSet = this.soldNumbersSet();

    const poolSet = new Set<number>(sold.slice(0, 12));
    for (const n of board) {
      if (poolSet.size >= 12) break;
      poolSet.add(n);
    }
    const allBallNums = [...poolSet];

    this.tombolaBalls = allBallNums.map((num, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const isMine = mySet.has(num);
      const isSold = soldSet.has(num);
      return {
        num,
        isMine,
        isSold,
        x: cx - 48 + col * 32 + (row % 2) * 8,
        y: cy + 5 + row * 28,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 2,
        r: isMine || isSold ? 17 : 14,
        extracted: false,
      };
    });
  }

  private ensureTombolaRunning(): void {
    const canvas = this.tombolaCanvas?.nativeElement;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    const currentKey = `${this.raffleId()}-${this.myNumbers().join(',')}`;
    if (this.tombolaInitializedForRaffle !== currentKey || this.tombolaBalls.length === 0) {
      this.initTombolaBalls();
      this.tombolaInitializedForRaffle = currentKey;
    }

    if (this.tombolaRafId !== null) return;

    const cx = 115;
    const cy = 115;
    const drumR = 108;

    const renderLoop = () => {
      if (this.selectedEffect() !== 'TOMBOLA' || !this.showLiveBoard()) {
        this.tombolaRafId = null;
        return;
      }

      const discarded = this.discardedNumbersSet();
      const winNum = this.winningCellNumber();
      const extractedNow = this.tombolaExtractedBall()?.number ?? null;

      this.tombolaBalls.forEach((b) => {
        b.extracted =
          discarded.has(b.num) ||
          (this.phase() === 'result' && winNum === b.num) ||
          extractedNow === b.num;
      });

      const speed = this.data()?.drawSpeed ?? 'NORMAL';
      const activePower = speed === 'SLOW' ? 2.2 : speed === 'FAST' ? 4.4 : 3.2;
      const airPower =
        this.phase() === 'spinning' && !this.betweenAttempts() && !this.waitingForAdminClick()
          ? activePower
          : 1;
      this.stepTombolaPhysics(cx, cy, drumR, airPower);

      ctx!.clearRect(0, 0, canvas.width, canvas.height);

      if (airPower > 1.5) {
        ctx!.save();
        ctx!.strokeStyle = 'rgba(167, 243, 208, 0.25)';
        ctx!.lineWidth = 2;
        for (let k = -2; k <= 2; k++) {
          ctx!.beginPath();
          ctx!.moveTo(cx + k * 14, cy + drumR - 6);
          ctx!.lineTo(cx + k * 22 + (Math.random() - 0.5) * 8, cy - 20);
          ctx!.stroke();
        }
        ctx!.restore();
      }

      this.tombolaBalls.forEach((b) => {
        if (b.extracted) return;
        const grad = ctx!.createRadialGradient(
          b.x - b.r * 0.32,
          b.y - b.r * 0.32,
          2,
          b.x,
          b.y,
          b.r,
        );
        if (b.isMine) {
          grad.addColorStop(0, '#6EE7B7');
          grad.addColorStop(0.65, '#10B981');
          grad.addColorStop(1, '#064E3B');
        } else if (b.isSold) {
          grad.addColorStop(0, '#93C5FD');
          grad.addColorStop(0.65, '#2563EB');
          grad.addColorStop(1, '#1E3A8A');
        } else {
          grad.addColorStop(0, '#F1F5F9');
          grad.addColorStop(0.7, '#94A3B8');
          grad.addColorStop(1, '#475569');
        }

        ctx!.beginPath();
        ctx!.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx!.fillStyle = grad;
        ctx!.fill();

        ctx!.lineWidth = b.isMine ? 2 : 1;
        ctx!.strokeStyle = b.isMine ? '#A7F3D0' : 'rgba(255,255,255,0.35)';
        ctx!.stroke();

        ctx!.fillStyle = b.isMine || b.isSold ? '#FFFFFF' : '#0F172A';
        ctx!.font = `800 ${b.r === 17 ? '12px' : '10px'} "JetBrains Mono", monospace`;
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.fillText(this.padNumber(b.num), b.x, b.y);
      });

      ctx!.beginPath();
      ctx!.arc(cx, cy, drumR - 3, 0, Math.PI * 2);
      ctx!.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx!.lineWidth = 3;
      ctx!.stroke();

      if (typeof requestAnimationFrame !== 'undefined') {
        this.tombolaRafId = requestAnimationFrame(renderLoop);
      }
    };

    renderLoop();
  }

  private stepTombolaPhysics(cx: number, cy: number, drumR: number, airPower: number): void {
    const activeBalls = this.tombolaBalls.filter((b) => !b.extracted);

    activeBalls.forEach((b) => {
      // Constant downward gravity prevents balls from sticking to the ceiling
      b.vy += 0.38;

      // Bottom air nozzle fountain boost
      const distFromCenterX = b.x - cx;
      if (b.y > cy + 28 && Math.abs(distFromCenterX) < 62) {
        const boost =
          airPower > 1.5 ? 1.9 + Math.random() * 2.2 : 0.55 + Math.random() * 0.45;
        b.vy -= boost;
        b.vx +=
          (distFromCenterX === 0
            ? Math.random() - 0.5
            : Math.sign(distFromCenterX) * 0.4) +
          (Math.random() - 0.5) * 2.2 * airPower;
      }

      if (airPower > 1.5) {
        const dx = b.x - cx;
        const dy = b.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        b.vx += (-dy / len) * 0.28 + (Math.random() - 0.5) * 0.8;
        b.vy += (dx / len) * 0.28;
      }

      b.vx *= 0.985;
      b.vy *= 0.985;
      const maxSpeed = airPower > 1.5 ? 8.5 : 4.5;
      const spd = Math.hypot(b.vx, b.vy);
      if (spd > maxSpeed) {
        b.vx = (b.vx / spd) * maxSpeed;
        b.vy = (b.vy / spd) * maxSpeed;
      }

      b.x += b.vx;
      b.y += b.vy;
    });

    // 3-iteration elastic ball-to-ball collision resolution
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < activeBalls.length; i++) {
        for (let j = i + 1; j < activeBalls.length; j++) {
          const b1 = activeBalls[i];
          const b2 = activeBalls[j];
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.hypot(dx, dy) || 0.01;
          const minDist = b1.r + b2.r + 1.5;

          if (dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;

            b1.x -= nx * (overlap * 0.5);
            b1.y -= ny * (overlap * 0.5);
            b2.x += nx * (overlap * 0.5);
            b2.y += ny * (overlap * 0.5);

            const kx = b1.vx - b2.vx;
            const ky = b1.vy - b2.vy;
            const p = kx * nx + ky * ny;
            if (p > 0) {
              const restitution = 0.82;
              b1.vx -= p * nx * restitution;
              b1.vy -= p * ny * restitution;
              b2.vx += p * nx * restitution;
              b2.vy += p * ny * restitution;
            }
          }
        }
      }

      activeBalls.forEach((b) => {
        const dx = b.x - cx;
        const dy = b.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const maxR = drumR - b.r - 4;
        if (dist > maxR) {
          const nx = dx / dist;
          const ny = dy / dist;
          b.x = cx + nx * maxR;
          b.y = cy + ny * maxR;
          const dot = b.vx * nx + b.vy * ny;
          if (dot > 0) {
            b.vx = (b.vx - 2 * dot * nx) * 0.78;
            b.vy = (b.vy - 2 * dot * ny) * 0.78;
          }
          if (ny < -0.5 && b.vy < 1.2) {
            b.vy += 1.5;
          }
        }
      });
    }
  }

  private stopTombolaLoop(): void {
    if (this.tombolaRafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.tombolaRafId);
      this.tombolaRafId = null;
    }
  }

  playTick(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const eff = this.selectedEffect();
      osc.type =
        eff === 'SLOT_MACHINE'
          ? 'square'
          : eff === 'SNAKE' || eff === 'SUSPENSE_CONFETTI'
            ? 'triangle'
            : 'sine';
      const baseFreq =
        eff === 'RADAR' ? 780 : eff === 'SUSPENSE_CONFETTI' ? 310 : eff === 'SNAKE' ? 380 : 440;
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  playFanfare(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const start = ctx.currentTime + idx * 0.12;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.35);
      });
    } catch {}
  }

  launchConfetti(): void {
    const canvas = this.confettiCanvas?.nativeElement;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 640;
    canvas.height = canvas.parentElement?.clientHeight || 420;

    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      w: number;
      h: number;
      rot: number;
      vRot: number;
    }[] = [];
    const colors = ['#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6', '#FACC15'];

    for (let i = 0; i < 110; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 140,
        y: canvas.height * 0.35,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.85) * 14,
        color: colors[Math.floor(Math.random() * colors.length)],
        w: Math.random() * 9 + 5,
        h: Math.random() * 6 + 4,
        rot: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.25,
      });
    }

    let frame = 0;
    const render = () => {
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.32;
        p.rot += p.vRot;
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx!.restore();
      });
      frame++;
      if (frame < 110 && typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(render);
      } else {
        ctx!.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    render();
  }
}
