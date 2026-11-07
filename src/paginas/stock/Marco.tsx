import { Link, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Icono, type NombreIcono } from '@/componentes/ui/Icono';

/**
 * Pestañas del módulo de stock. Las que ya están en la v2 son enlaces internos; las que no,
 * abren la versión actual con la misma sesión. Se van migrando a lo largo de la fase 3.
 */
const EN_V2: { to: '/stock/entregas' | '/stock/todo' | '/stock/procesamiento' | '/stock/pagos' | '/stock/ordenes' | '/stock/tablero'; clave: string; icono: NombreIcono }[] = [
  { to: '/stock/entregas', clave: 'stock.pestanas.entregas', icono: 'bodega' },
  { to: '/stock/todo', clave: 'stock.pestanas.stock', icono: 'lista' },
  { to: '/stock/procesamiento', clave: 'stock.pestanas.procesamiento', icono: 'hoja' },
  { to: '/stock/pagos', clave: 'stock.pestanas.pagos', icono: 'precio' },
  { to: '/stock/ordenes', clave: 'stock.pestanas.ordenes', icono: 'barco' },
  { to: '/stock/tablero', clave: 'stock.pestanas.tablero', icono: 'grafico' },
];
const PESTANA = 'inline-flex h-11 shrink-0 items-center gap-2 rounded-t-lg border-b-2 border-transparent px-4 text-sm font-semibold text-tinta-2 hover:text-tinta';

export function MarcoStock() {
  const { t } = useTranslation();
  return (
    <div className="grid gap-8 [&>*]:min-w-0">
      <nav aria-label={t('stock.titulo')} className="-mx-4 flex relative overflow-x-auto border-b border-linea px-4 sm:mx-0 sm:px-0">
        {EN_V2.map((p) => (
          <Link key={p.to} to={p.to} className={PESTANA} activeProps={{ className: '!border-marca !text-marca' }}>
            <Icono nombre={p.icono} className="size-4" /> {t(p.clave)}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
