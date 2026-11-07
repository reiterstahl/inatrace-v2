import { useTranslation } from 'react-i18next';
import type { ApiCompanyDocument } from '@/api/gen/types.gen';
import { useVitrina, type DatosVitrina } from './datos';
import { Seccion, enlaceSeguro } from './Vitrina';
import { Carrusel } from '@/componentes/ui/Carrusel';

/** Convierte un enlace de YouTube a su versión sin cookies para insertarlo. Otros enlaces no se insertan. */
export function videoInsertable(enlace?: string | null): string | undefined {
  const u = enlaceSeguro(enlace);
  if (!u) return undefined;
  const url = new URL(u);
  let id: string | null = null;
  if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
  else if (/(^|\.)youtube\.com$/.test(url.hostname)) id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ?? null;
  return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : undefined;
}

function imagen(doc: ApiCompanyDocument, urlDoc: DatosVitrina['urlDoc']) {
  return doc.type === 'LINK' ? enlaceSeguro(doc.link) : urlDoc(doc.document?.storageKey);
}

export function Productores() {
  const d = useVitrina();
  const { t } = useTranslation();
  const video = videoInsertable(d.etiqueta.videoMeetTheFarmers?.link);
  const fotos = (d.etiqueta.photosMeetTheFarmers ?? []).filter((x) => imagen(x, d.urlDoc));
  const registros = (d.etiqueta.productionRecords ?? []).filter((x) => imagen(x, d.urlDoc));
  const vacio = !video && fotos.length === 0 && registros.length === 0;

  return (
    <Seccion titulo={t('vitrina.productores.titulo')}>
      <div className="grid gap-12">
        {vacio && <p className="text-tinta-2">{t('vitrina.productores.sin_contenido')}</p>}
        {video && (
          <div className="aspect-video overflow-hidden rounded-caja bg-tinta shadow-suave">
            <iframe src={video} title={t('vitrina.productores.video')} className="size-full" loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen />
          </div>
        )}
        {fotos.length > 0 && <Galeria docs={fotos} etiqueta={t('vitrina.productores.titulo')} />}
        {registros.length > 0 && (
          <section className="grid gap-4">
            <h2 className="font-titulo text-2xl font-semibold">{t('vitrina.productores.registros')}</h2>
            <Galeria docs={registros} etiqueta={t('vitrina.productores.registros')} />
          </section>
        )}
      </div>
    </Seccion>
  );
}

/** Fotos en un carrusel con flechas y puntos (dedo, rueda y teclado también funcionan). */
function Galeria({ docs, etiqueta }: { docs: ApiCompanyDocument[]; etiqueta: string }) {
  const { urlDoc } = useVitrina();
  return (
    <Carrusel etiqueta={etiqueta}>
      {docs.map((doc) => (
        <figure key={doc.id ?? doc.name} className="overflow-hidden rounded-caja border border-linea bg-superficie shadow-suave">
          <img src={imagen(doc, urlDoc)} alt={doc.name ?? ''} loading="lazy" className="aspect-[4/3] w-full object-cover" />
          {(doc.name || doc.quote || doc.description) && (
            <figcaption className="grid gap-1 p-4">
              {doc.quote && <blockquote className="font-titulo text-lg leading-snug italic">“{doc.quote}”</blockquote>}
              {doc.name && <p className="font-semibold">{doc.name}</p>}
              {doc.description && <p className="text-sm text-tinta-2">{doc.description}</p>}
            </figcaption>
          )}
        </figure>
      ))}
    </Carrusel>
  );
}
