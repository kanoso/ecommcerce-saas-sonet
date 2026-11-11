import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminApi } from '../../../core/api/admin-api';
import { AdminRaffleCreatePage } from './admin-raffle-create.page';

describe('AdminRaffleCreatePage', () => {
  let fixture: ComponentFixture<AdminRaffleCreatePage>;
  let component: AdminRaffleCreatePage;
  let el: HTMLElement;
  let router: Router;
  let adminApiMock: { createRaffle: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    adminApiMock = {
      createRaffle: vi.fn().mockReturnValue(of({ raffleId: 'r-created', status: 'DRAFT' })),
    };

    await TestBed.configureTestingModule({
      imports: [AdminRaffleCreatePage],
      providers: [
        provideRouter([]),
        { provide: AdminApi, useValue: adminApiMock },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(AdminRaffleCreatePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('renders form inputs for RF-10', () => {
    expect(el.querySelector('#titulo')).not.toBeNull();
    expect(el.querySelector('#premio')).not.toBeNull();
    expect(el.querySelector('#precio_boleto')).not.toBeNull();
    expect(el.querySelector('#numero_min')).not.toBeNull();
    expect(el.querySelector('#numero_max')).not.toBeNull();
    expect(el.querySelector('button[type="submit"]')).not.toBeNull();
  });

  it('validates required fields before submitting', () => {
    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(adminApiMock.createRaffle).not.toHaveBeenCalled();
    expect(el.textContent).toContain('El título es obligatorio');
  });

  it('validates that numero_max is greater than numero_min', () => {
    component.form.patchValue({
      titulo: 'Rifa Inválida',
      premio: 'Premio',
      precio_boleto: 10,
      numero_min: 100,
      numero_max: 50,
    });

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(adminApiMock.createRaffle).not.toHaveBeenCalled();
    expect(el.textContent).toContain('El número máximo debe ser mayor que el mínimo');
  });

  it('submits valid form to API and navigates to raffle management on success', () => {
    component.form.patchValue({
      titulo: 'Gran Rifa Camioneta',
      premio: 'Camioneta 4x4',
      precio_boleto: 50,
      numero_min: 1,
      numero_max: 1000,
    });

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(adminApiMock.createRaffle).toHaveBeenCalledWith({
      titulo: 'Gran Rifa Camioneta',
      premio: 'Camioneta 4x4',
      precio_boleto: 50,
      numero_min: 1,
      numero_max: 1000,
      intento_ganador: 1,
      efecto_sorteo: 'SLOT_MACHINE',
      modalidad_sorteo: 'AUTOMATIC',
      duracion_efecto_seg: 4,
      velocidad_efecto: 'NORMAL',
      descripcion_premio: null,
      imagenes_premio: [],
    });

    expect(router.navigate).toHaveBeenCalledWith(['/admin/rifas', 'r-created']);
  });

  it('shows error notice when API call fails', () => {
    adminApiMock.createRaffle.mockReturnValue(throwError(() => new Error('Error')));

    component.form.patchValue({
      titulo: 'Gran Rifa Camioneta',
      premio: 'Camioneta 4x4',
      precio_boleto: 50,
      numero_min: 1,
      numero_max: 1000,
    });

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(el.textContent).toContain('No se pudo crear la rifa');
  });
});
