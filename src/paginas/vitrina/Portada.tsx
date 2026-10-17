import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { urlDocumento } from '@/api/respuesta';
import { Icono } from '@/componentes/ui/Icono';
import { pestanas, useVitrina } from './datos';
import { iconoPestana, enlacePestana } from './Vitrina';
import { colorTituloProducto } from './marca';

export function Portada() {
  const d = useVitrina();
  const { t } = useTranslation();
  const fondo = urlDocumento(d.ajustes.landingPageBackgroundImage?.storageKey);
  const imagen = urlDocumento(d.ajustes.landingPageImage?.storageKey);
  const colorTitulo = colorTituloProducto(d.ajustes, !!fondo);
  const secciones = pestanas(d.ajustes);

  return (
    <>
      <section
        className="relative isolate flex min-h-[78svh] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center"
        style={{ background: 'var(--portada, var(--marca))', color: 'var(--sobre-portada, var(--sobre-marca))' }}
      >
        {fondo && (
          <>
            <img src={fondo} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/10 via-black/25 to-black/55" />
          </>
        )}
        {imagen && <img src={imagen} alt="" className="mb-8 max-h-[38svh] w-auto max-w-[min(80vw,420px)] object-contain drop-shadow-xl" />}
        <h1
          className="max-w-2xl font-titulo text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl"
          style={{ color: fondo ? '#fff' : colorTitulo, fontFamily: 'var(--fuente-producto, var(--font-titulo))' }}
        >
          {d.producto}
        </h1>
        <Link
          to={enlacePestana('journey')}
          params={d.params}
          className="mt-10 inline-flex h-12 items-center gap-2 rounded-full px-7 font-semibold shadow-alta transition-transform hover:scale-[1.02]"
          style={{ background: 'var(--acento)', color: 'var(--sobre-acento, #fff)' }}
        >
          {t('vitrina.ver_recorrido')}
          <Icono nombre="flecha" className="size-4" />
        </Link>
      </section>

      <nav className="relative z-10 mx-auto -mt-10 max-w-3xl px-5 pb-12" aria-label={t('vitrina.recorrido.titulo')}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {secciones.map((p) => (
            <li key={p}>
              <Link
                to={enlacePestana(p)}
                params={d.params}
                className="group flex h-full flex-col gap-3 rounded-caja border border-linea bg-superficie p-4 shadow-suave transition-shadow hover:shadow-alta"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-marca-suave text-marca">
                  <Icono nombre={iconoPestana(p)} className="size-5" />
                </span>
                <span className="flex items-center justify-between gap-2 font-semibold first-letter:uppercase">
                  {t(`vitrina.pestanas.${p}`)}
                  <Icono nombre="flecha" className="size-4 text-tinta-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
