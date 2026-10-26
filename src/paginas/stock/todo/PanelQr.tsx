import { useEffect, useId, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { procesamiento } from '@/api/procesamiento';
import type { ApiStockOrder } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { CodigoQr, svgQr } from '@/componentes/ui/CodigoQr';
import { Icono } from '@/componentes/ui/Icono';
import { enAnterior, urlQr } from '@/util/entorno';

/**
 * QR de un lote que pasó por "generar código QR": el mismo que imprime la versión actual. Apunta a
 * una etiqueta publicada del producto final; si hay varias (p. ej. una por idioma), se elige.
 */
export function PanelQr({ orden }: { orden: ApiStockOrder }) {
  const { t } = useTranslation();
  const idEtiqueta = useId();
  const codigo = orden.qrCodeTag!;
  const final = orden.qrCodeTagFinalProduct;
  const etiquetas = useQuery({ ...procesamiento.etiquetasProductoFinal(final?.product?.id ?? 0, final?.id ?? 0), enabled: !!final?.id && !!final.product?.id });
  const lista = etiquetas.data ?? [];
  const [elegida, setElegida] = useState<number | null>(null);
  useEffect(() => {
    if (elegida === null && lista.length > 0) setElegida(lista[0]!.id ?? null);
  }, [lista, elegida]);
  const etiqueta = lista.find((l) => l.id === elegida);
  const url = etiqueta?.uuid ? urlQr(etiqueta, codigo) : null;
  const [copiado, setCopiado] = useState(false);

  function descargar() {
    if (!url) return;
    const blob = new Blob([svgQr(url)], { type: 'image/svg+xml' });
    const enlace = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `qr-${orden.internalLotNumber || codigo}.svg` });
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  }

  function imprimir() {
    document.documentElement.classList.add('modo-impresion');
    window.addEventListener('afterprint', () => document.documentElement.classList.remove('modo-impresion'), { once: true });
    window.print();
  }

  async function copiar() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sin permiso de portapapeles: la URL queda visible para copiarla a mano */
    }
  }

  return (
    <section aria-labelledby={idEtiqueta + '-t'} className="rounded-caja border border-linea bg-superficie p-5 shadow-suave sm:p-6">
      <h2 id={idEtiqueta + '-t'} className="font-titulo text-lg font-semibold">{t('stock.qr.titulo')}</h2>
      <p className="mt-1 text-sm text-tinta-2">
        {t('stock.qr.descripcion', { producto: final ? `${final.name}${final.product?.name ? ` (${final.product.name})` : ''}` : '—' })}
      </p>

      {etiquetas.isPending && final?.id ? (
        <p className="mt-4 text-sm text-tinta-3">{t('comun.cargando')}</p>
      ) : lista.length === 0 ? (
        <p className="mt-4 rounded-lg bg-aviso-suave p-3 text-sm text-aviso">
          {t('stock.qr.sin_etiquetas')}{' '}
          {final?.product?.id && <a href={enAnterior(`/product-labels/${final.product.id}/final-products`)} className="font-semibold underline">{t('portal.version_actual')}</a>}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-start gap-6">
          <div className="tarjeta-imprimible grid justify-items-center gap-2 rounded-lg bg-white p-2 text-black">
            {url && <CodigoQr valor={url} etiqueta={t('stock.qr.alt', { lote: orden.internalLotNumber || codigo })} className="size-40" />}
            <span className="max-w-40 text-center text-xs">{orden.internalLotNumber}</span>
          </div>
          <div className="grid min-w-0 flex-1 gap-3">
            {lista.length > 1 && (
              <label className="grid gap-1 text-sm sm:max-w-xs">
                <span className="font-semibold text-tinta-2">{t('stock.qr.etiqueta')}</span>
                <select id={idEtiqueta} value={elegida ?? ''} onChange={(e) => setElegida(Number(e.target.value))} className="h-10 rounded-lg border border-linea-fuerte bg-superficie px-3">
                  {lista.map((l) => <option key={l.id} value={l.id}>{l.title} ({(l.language ?? '').toUpperCase()})</option>)}
                </select>
              </label>
            )}
            {url && (
              <p className="flex min-w-0 items-center gap-2 rounded-lg bg-superficie-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-mono text-xs" title={url}>{url}</span>
                <button type="button" onClick={() => void copiar()} className="shrink-0 font-semibold text-marca hover:underline">{copiado ? t('stock.qr.copiado') : t('stock.qr.copiar')}</button>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {etiqueta?.uuid && (
                <Link to="/p-cd/$etiqueta/$qr" params={{ etiqueta: etiqueta.uuid, qr: codigo }} target="_blank" className="inline-flex h-9 items-center gap-2 rounded-lg bg-marca px-3 text-sm font-semibold text-sobre-marca hover:bg-marca-fuerte">
                  <Icono nombre="externo" className="size-4" /> {t('stock.qr.ver_vitrina')}
                </Link>
              )}
              <Boton chico variante="secundario" onClick={descargar} disabled={!url}>
                <Icono nombre="descarga" className="size-4" /> {t('stock.qr.descargar')}
              </Boton>
              <Boton chico variante="secundario" onClick={imprimir} disabled={!url}>{t('stock.qr.imprimir')}</Boton>
            </div>
            <p className="text-xs text-tinta-3">{t('stock.qr.nota')}</p>
          </div>
        </div>
      )}
    </section>
  );
}
