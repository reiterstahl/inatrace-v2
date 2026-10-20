import { Link, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Icono } from '@/componentes/ui/Icono';
import { enAnterior } from '@/util/entorno';

/**
 * Pestañas del módulo de stock. Las que aún no están en la v2 abren la versión actual, con la
 * misma sesión; se pasan a enlaces internos a medida que avanza la fase 3.
 */
const PENDIENTES = [
  { clave: 'stock.pestanas.stock', anterior: '/my-stock/all-stock' },
  { clave: 'stock.pestanas.procesamiento', anterior: '/my-stock/processing' },
  { clave: 'stock.pestanas.pagos', anterior: '/my-stock/payments' },
  { clave: 'stock.pestanas.ordenes', anterior: '/my-stock/orders' },
];

const PESTANA = 'inline-flex h-11 shrink-0 items-center gap-2 rounded-t-lg border-b-2 border-transparent px-4 text-sm font-semibold text-tinta-2 hover:text-tinta';

export function MarcoStock() {
  const { t } = useTranslation();
  return (
    <div className="grid gap-8">
      <nav aria-label={t('stock.titulo')} className="-mx-4 flex overflow-x-auto border-b border-linea px-4 sm:mx-0 sm:px-0">
        <Link to="/stock/entregas" className={PESTANA} activeProps={{ className: '!border-marca !text-marca' }}>
          <Icono nombre="bodega" className="size-4" /> {t('stock.pestanas.entregas')}
        </Link>
        {PENDIENTES.map((p) => (
          <a key={p.clave} href={enAnterior(p.anterior)} className={PESTANA + ' font-medium text-tinta-3'} title={t('portal.en_actual')}>
            {t(p.clave)} <Icono nombre="externo" className="size-3.5" />
          </a>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
