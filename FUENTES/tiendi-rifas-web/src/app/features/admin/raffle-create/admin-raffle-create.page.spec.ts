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
    expect(el.querySelector('#premio-titulo-0')).not.toBeNull();
    expect(el.querySelector('input[name="modo_exclusion_ganador"][value="TICKET_ONLY"]')).not.toBeNull();
    expect(el.querySelector('input[name="modo_exclusion_ganador"][value="BUYER"]')).not.toBeNull();
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
      precio_boleto: 50,
      numero_min: 1,
      numero_max: 1000,
    });
    component.prizes.set([{ title: 'Camioneta 4x4', description: '', images: [] }]);

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(adminApiMock.createRaffle).toHaveBeenCalledWith({
      titulo: 'Gran Rifa Camioneta',
      precio_boleto: 50,
      numero_min: 1,
      numero_max: 1000,
      intento_ganador: 1,
      efecto_sorteo: 'SLOT_MACHINE',
      modalidad_sorteo: 'AUTOMATIC',
      duracion_efecto_seg: 4,
      velocidad_efecto: 'NORMAL',
      premios: [{ titulo: 'Camioneta 4x4', descripcion: null, imagenes: [] }],
      modo_exclusion_ganador: 'TICKET_ONLY',
    });

    expect(router.navigate).toHaveBeenCalledWith(['/admin/rifas', 'r-created']);
  });

  it('sends the ordered prize list and the chosen exclusion mode', () => {
    component.form.patchValue({ titulo: 'Rifa Navideña', precio_boleto: 5, numero_min: 1, numero_max: 100 });
    component.prizes.set([{ title: 'Moto', description: '', images: [] }]);
    fixture.detectChanges();

    (el.querySelector('[data-testid="add-prize"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const second = el.querySelector('#premio-titulo-1') as HTMLInputElement;
    second.value = 'Auto';
    second.dispatchEvent(new Event('input'));
    (el.querySelector('[data-testid="move-prize-up-1"]') as HTMLButtonElement).click();
    (el.querySelector('input[name="modo_exclusion_ganador"][value="BUYER"]') as HTMLInputElement).click();
    fixture.detectChanges();

    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));

    expect(adminApiMock.createRaffle).toHaveBeenCalledWith(
      expect.objectContaining({
        premios: [
          { titulo: 'Auto', descripcion: null, imagenes: [] },
          { titulo: 'Moto', descripcion: null, imagenes: [] },
        ],
        modo_exclusion_ganador: 'BUYER',
      }),
    );
  });

  it('removes a prize but always keeps at least one', () => {
    component.prizes.set([
      { title: 'Moto', description: '', images: [] },
      { title: 'Auto', description: '', images: [] },
    ]);
    fixture.detectChanges();

    (el.querySelector('[data-testid="remove-prize-0"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.prizes().map((p) => p.title)).toEqual(['Auto']);
    expect((el.querySelector('[data-testid="remove-prize-0"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('does not submit a prize without a title', () => {
    component.form.patchValue({ titulo: 'Rifa', precio_boleto: 5, numero_min: 1, numero_max: 100 });
    component.prizes.set([{ title: '  ', description: '', images: [] }]);

    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(adminApiMock.createRaffle).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Cada premio necesita un título');
  });

  it('shows error notice when API call fails', () => {
    adminApiMock.createRaffle.mockReturnValue(throwError(() => new Error('Error')));

    component.form.patchValue({
      titulo: 'Gran Rifa Camioneta',
      precio_boleto: 50,
      numero_min: 1,
      numero_max: 1000,
    });
    component.prizes.set([{ title: 'Camioneta 4x4', description: '', images: [] }]);

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(el.textContent).toContain('No se pudo crear la rifa');
  });
});
