import clsx from 'clsx';
import { COLORES_AVATAR, type Avatar as DatosAvatar, type Semilla } from '@/util/avatar';

/** Trazos de cada semilla (24×24, línea blanca como el resto de los íconos). */
const TRAZOS: Record<Semilla, string[]> = {
  // Grano de café: óvalo inclinado con su surco.
  cafe: ['M15.9 4.6c3.2 1.9 3.9 6.8 1.5 10.9s-7 6.4-10.2 4.5-3.9-6.8-1.5-10.9 7-6.4 10.2-4.5z', 'M15.9 4.6c-1.8 1.4-2.3 3.4-2.6 5.4s-1 4.4-3.7 6.6c-.9.8-1.9 1.4-2.9 1.8'],
  // Mazorca de cacao con sus costillas.
  cacao: ['M12 2.5c3.6 2.6 5 6.2 5 9.5s-1.4 6.9-5 9.5c-3.6-2.6-5-6.2-5-9.5s1.4-6.9 5-9.5z', 'M12 3.5v17', 'M9.4 5.5c-.9 4.3-.9 8.7 0 13', 'M14.6 5.5c.9 4.3.9 8.7 0 13'],
  // Mazorca de maíz con hoja.
  maiz: ['M13 2.8c2.8 0 4 2.9 4 6.5v3.4c0 4.2-2 7.3-4 7.3s-4-3.1-4-7.3V9.3c0-3.6 1.2-6.5 4-6.5z', 'M9.2 8.5h7.6M9 12.3h8M9.6 16.1h6.8M13 2.8v17', 'M9.3 13.5c-2.6.6-4.3 3.1-4.3 7.7 2.6-.9 4.6-2.6 5.6-4.9'],
  // Frijol con su hilo.
  frijol: ['M7.6 5.2c3.1-2.3 8.6-1.6 10.1 2.5 1.2 3.3-.6 5.9-3.5 6-2.1 0-3 1.1-3 3 0 3.1-3.2 4.3-5.5 2.4-3.4-2.9-1.6-11.1 1.9-13.9z', 'M11.2 13.7c1-.2 2 .3 2.4 1.2'],
  // Pipa de girasol con sus rayas.
  girasol: ['M12 2.8c3.2 4.1 5.2 8 5.2 11.2a5.2 5.2 0 0 1-10.4 0c0-3.2 2-7.1 5.2-11.2z', 'M12 6v13.2', 'M9.5 9.6c-.7 2.2-.9 4.6-.6 7.1', 'M14.5 9.6c.7 2.2.9 4.6.6 7.1'],
  // Semilla que brota.
  brote: ['M7.5 16c0-3.1 2.1-4.6 4.5-4.6s4.5 1.5 4.5 4.6-2.1 5.2-4.5 5.2-4.5-2.1-4.5-5.2z', 'M12 11.4V6.8', 'M12 8.6C11 5.7 8.3 4.4 5.5 5c.2 3 2.9 4.5 6.5 3.6z', 'M12 7.6c1-2.9 3.7-4.2 6.5-3.6-.2 3-2.9 4.5-6.5 3.6z'],
};

/** Imagen de perfil genérica: la semilla en blanco sobre el color elegido. */
export function Avatar({ avatar, className }: { avatar: DatosAvatar; className?: string }) {
  return (
    <span aria-hidden="true" className={clsx('grid shrink-0 place-items-center rounded-full', className)} style={{ background: COLORES_AVATAR[avatar.color] }}>
      <svg viewBox="0 0 24 24" className="size-[62%]" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        {TRAZOS[avatar.semilla].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}
