import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RidersStore } from '../riders.store';
import { RiderInfoComponent } from '../components/rider-info.component';
import { RiderDocumentsComponent } from '../components/rider-documents.component';
import { SkeletonComponent } from '../../../shared/ui/atoms/skeleton.component';

@Component({
  selector: 'td-rider-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RiderInfoComponent, RiderDocumentsComponent, SkeletonComponent],
  templateUrl: './rider-detail.page.html',
  styleUrl: './rider-detail.page.scss',
})
export class RiderDetailPage implements OnInit {
  protected readonly store = inject(RidersStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected riderId = '';

  // Reject inline form state
  protected showRejectForm = signal(false);
  protected rejectReason = signal('');

  ngOnInit(): void {
    this.riderId = this.route.snapshot.paramMap.get('riderId') ?? '';
    if (this.riderId) {
      this.store.loadDetail(this.riderId);
    }
  }

  goBack(): void {
    void this.router.navigate(['/vendor/riders']);
  }

  onApprove(): void {
    void this.store.approveRider(this.riderId);
  }

  onToggleRejectForm(): void {
    this.showRejectForm.update((v) => !v);
    this.rejectReason.set('');
  }

  onReasonInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.rejectReason.set(value);
  }

  onConfirmReject(): void {
    const reason = this.rejectReason().trim();
    if (!reason || reason.length > 500) return;
    void this.store.rejectRider(this.riderId, reason);
  }

  get isRejectSubmitDisabled(): boolean {
    const reason = this.rejectReason().trim();
    return !reason || reason.length > 500 || this.store.isActing();
  }
}
