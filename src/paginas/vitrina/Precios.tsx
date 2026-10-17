import { useTranslation } from 'react-i18next';
import { HtmlSeguro } from '@/componentes/ui/HtmlSeguro';
import { QR_VACIO } from '@/api/consultas';
import { useVitrina } from './datos';
import { graficoFinca, graficoProductor, type GraficoProductor } from './precios';
import { Seccion } from './Vitrina';

const cifra = (n: number, porcentaje: boolean) => (porcentaje ? `${n}%` : `$${n}`);

export function Precios() {
  const d = useVitrina();
  const { t } = useTranslation();
  const productor = graficoProductor(d.ajustes, d.qr);
  const finca = graficoFinca(d.ajustes, d.qr);
  const pedido = d.params.qr !== QR_VACIO ? d.qr?.orderId : undefined;

  return (
    <Seccion titulo={t('vitrina.precios.titulo')}>
      <div className="grid gap-12">
        {productor && (
          <section className="grid gap-6">
            <p className="text-lg leading-relaxed text-tinta-2">
              {pedido
                ? t('vitrina.precios.pedido', { pedido, unidad: t(`vitrina.precios.unidad.${productor.unidad}`) })
                : t('vitrina.precios.sin_pedido', { unidad: t(`vitrina.precios.unidad.${productor.unidad}`) })}
            </p>
            <BarrasProductor g={productor} producto={d.producto} />
            <HtmlSeguro html={d.campo('comparisonOfPrice.description')} />
          </section>
        )}

        {finca && (
          <section className="grid gap-6">
            <h2 className="font-titulo text-2xl font-semibold">{t('vitrina.precios.titulo_ingreso', { producto: d.producto })}</h2>
            <div className="grid grid-cols-[1fr_auto] items-end gap-x-6 gap-y-2 rounded-caja border border-linea bg-superficie p-6 shadow-suave">
              <div className="grid gap-2 self-stretch text-sm">
                <p className="flex flex-1 items-center text-tinta-2" style={{ minHeight: finca.alturas.aumento }}>
                  {t('vitrina.precios.pagado_como', { producto: d.producto })}
                </p>
                <p className="flex items-center text-tinta-2" style={{ minHeight: finca.alturas.promedio }}>
                  {t('vitrina.precios.promedio_sin', { producto: d.producto })}
                </p>
              </div>
              <div className="flex w-24 flex-col overflow-hidden rounded-xl">
                <div className="grid place-items-center bg-marca font-bold text-sobre-marca" style={{ height: Math.max(finca.alturas.aumento, 28) }}>
                  {finca.aumento}
                </div>
                <div className="grid place-items-center bg-linea-fuerte font-bold text-tinta" style={{ height: Math.max(finca.alturas.promedio, 28) }}>
                  ${finca.promedio}
                </div>
              </div>
            </div>
            <HtmlSeguro html={d.campo('settings.incomeIncreaseDescription')} />
          </section>
        )}
      </div>
    </Seccion>
  );
}

function BarrasProductor({ g, producto }: { g: GraficoProductor; producto: string }) {
  const { t } = useTranslation();
  const barras = [
    { nombre: t('vitrina.precios.mercado_mundial'), valor: g.mundo, alto: g.alturas.mundo, propia: false },
    { nombre: t('vitrina.precios.fairtrade'), valor: g.fairtrade, alto: g.alturas.fairtrade, propia: false },
    { nombre: producto, valor: g.producto, alto: g.alturas.producto, propia: true },
  ];
  return (
    <figure className="rounded-caja border border-linea bg-superficie p-6 shadow-suave">
      <div className="grid grid-cols-3 items-end gap-4 sm:gap-8" style={{ height: 260 }}>
        {barras.map((b) => (
          <div key={b.nombre} className="flex h-full flex-col items-center justify-end gap-2">
            <span className="text-lg font-bold tabular-nums">{cifra(b.valor, g.porcentaje)}</span>
            <span className={'w-full max-w-24 rounded-t-xl ' + (b.propia ? 'bg-marca' : 'bg-acento/60')} style={{ height: Math.max(b.alto, 4) }} />
          </div>
        ))}
      </div>
      <figcaption className="mt-3 grid grid-cols-3 gap-4 border-t border-linea pt-3 text-center text-xs leading-snug text-tinta-2 sm:gap-8 sm:text-sm">
        {barras.map((b) => (
          <span key={b.nombre} className={b.propia ? 'font-semibold text-tinta' : ''}>
            {b.nombre}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
