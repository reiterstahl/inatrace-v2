import { useState } from 'react';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ajustes, useGuardarAjuste } from '@/api/ajustes';
import { consultas } from '@/api/consultas';
import { Boton } from '@/componentes/ui/Boton';
import { Area, Campo } from '@/componentes/ui/Campo';
import { Aviso, Cargando, EstadoError } from '@/componentes/ui/Estados';
import { editaAjustes, enlaceValido, normalizarEnlace } from '@/util/ajustes';
import { Tarjeta } from '../productos/piezas';

/**
 * Ajustes globales de la instancia (los «ajustes adicionales» de la versión actual): el texto que la
 * vitrina muestra cuando un QR apunta a una etiqueta sin publicar y un enlace de ayuda para las
 * etiquetas. Solo la administración del sistema los edita.
 */
export function AjustesAdministracion() {
  const { data: yo } = useSuspenseQuery(consultas.perfil());
  const texto = useQuery(ajustes.valor('textoNoPublicada'));
  const enlace = useQuery(ajustes.valor('enlaceAyudaEtiquetas'));
  if (texto.isPending || enlace.isPending) return <Cargando />;
  if (texto.isError || enlace.isError) return <EstadoError texto={(texto.error ?? enlace.error)!.message} reintentar={() => { void texto.refetch(); void enlace.refetch(); }} />;
  return <FormularioAjustes texto={texto.data} enlace={enlace.data} editable={editaAjustes(yo.role)} />;
}

function FormularioAjustes({ texto: textoInicial, enlace: enlaceInicial, editable }: { texto: string; enlace: string; editable: boolean }) {
  const { t } = useTranslation();
  const guardar = useGuardarAjuste();
  // Lo guardado: contra eso se compara para saber si hay cambios (se actualiza al guardar).
  const [base, setBase] = useState({ texto: textoInicial, enlace: enlaceInicial });
  const [texto, setTexto] = useState(textoInicial);
  const [enlace, setEnlace] = useState(enlaceInicial);
  const [intento, setIntento] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'mal'; texto: string } | null>(null);
  const cambio = texto !== base.texto || enlace !== base.enlace;
  const errorEnlace = intento && !enlaceValido(enlace) ? t('administracion.ajustes.enlace_invalido') : undefined;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setIntento(true);
    if (!enlaceValido(enlace)) return;
    setAviso(null);
    try {
      // Solo se guarda lo que cambió, como la versión actual.
      const nuevo = { texto: texto.trim(), enlace: normalizarEnlace(enlace) };
      if (texto !== base.texto) await guardar.mutateAsync({ ajuste: 'textoNoPublicada', valor: nuevo.texto });
      if (enlace !== base.enlace) await guardar.mutateAsync({ ajuste: 'enlaceAyudaEtiquetas', valor: nuevo.enlace });
      setBase(nuevo);
      setTexto(nuevo.texto);
      setEnlace(nuevo.enlace);
      setAviso({ tono: 'ok', texto: t('comun.guardado') });
    } catch (x) {
      setAviso({ tono: 'mal', texto: (x as Error).message });
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-5">
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      {!editable && <Aviso tono="info">{t('administracion.ajustes.solo_lectura')}</Aviso>}
      <fieldset disabled={!editable} className="grid min-w-0 gap-5">
        <Tarjeta id="no-publicada" titulo={t('administracion.ajustes.no_publicada')} ayuda={t('administracion.ajustes.no_publicada_ayuda')}>
          <Area etiqueta={t('administracion.ajustes.no_publicada_texto')} rows={3} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </Tarjeta>
        <Tarjeta id="enlace-ayuda" titulo={t('administracion.ajustes.enlace')} ayuda={t('administracion.ajustes.enlace_ayuda')}>
          <Campo etiqueta={t('administracion.ajustes.enlace_url')} type="url" inputMode="url" placeholder="https://" value={enlace} onChange={(e) => setEnlace(e.target.value)} error={errorEnlace} className="sm:max-w-xl" />
        </Tarjeta>
      </fieldset>
      {editable && (
        <div className="flex justify-end">
          <Boton type="submit" disabled={!cambio || guardar.isPending}>{t('comun.guardar')}</Boton>
        </div>
      )}
    </form>
  );
}
