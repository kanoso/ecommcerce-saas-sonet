import { createLightbox } from './lightbox-state';

describe('createLightbox', () => {
  it('starts closed, opens on a list of images at an index and closes', () => {
    const lightbox = createLightbox();
    expect(lightbox.state()).toBeNull();

    lightbox.open(['a.jpg', 'b.jpg'], 1, 'Moto');
    expect(lightbox.state()).toEqual({ images: ['a.jpg', 'b.jpg'], index: 1, alt: 'Moto' });

    lightbox.close();
    expect(lightbox.state()).toBeNull();
  });

  it('does not open without images', () => {
    const lightbox = createLightbox();
    lightbox.open([], 0, 'Moto');
    expect(lightbox.state()).toBeNull();
  });
});
