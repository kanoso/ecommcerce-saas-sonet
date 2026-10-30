import { Clock } from '../ports/clock';

export class FakeClock implements Clock {
  private currentTime: Date;

  constructor(initialTime?: Date) {
    this.currentTime = initialTime ? new Date(initialTime) : new Date('2026-11-01T10:00:00Z');
  }

  now(): Date {
    return new Date(this.currentTime);
  }

  setTime(time: Date): void {
    this.currentTime = new Date(time);
  }

  advanceMinutes(minutes: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + minutes * 60 * 1000);
  }

  advanceSeconds(seconds: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + seconds * 1000);
  }
}
