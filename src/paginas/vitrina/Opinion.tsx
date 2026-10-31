import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useEnviarOpinion } from '@/api/consultas';
import type { ApiProductLabelFeedback } from '@/api/gen/types.gen';
import { Boton } from '@/componentes/ui/Boton';
import { Area, Campo } from '@/componentes/ui/Campo';
import { Aviso } from '@/componentes/ui/Estados';
import { HtmlSeguro } from '@/componentes/ui/HtmlSeguro';
import { Icono } from '@/componentes/ui/Icono';
import { useVitrina } from './datos';
import { Seccion } from './Vitrina';

const MAX = 500;
const TIPOS = ['PRAISE', 'PROPOSAL', 'COMPLAINT'] as const;
const SABORES = ['Better', 'Same', 'Worse'] as const;
const GENEROS = ['Female', 'Male', 'N/A'] as const;
const VACIO = { tipo: 'PRAISE' as (typeof TIPOS)[number], comentario: '', sabor: '', edad: '', genero: '', correo: '', acepto: false };

export function validarOpinion(f: typeof VACIO) {
  const e: Partial<Record<'comentario' | 'edad' | 'correo' | 'acepto', string>> = {};
  if (f.comentario.length > MAX) e.comentario = 'vitrina.opinion.comentario_largo';
  if (f.edad && !(/^\d{1,3}$/.test(f.edad) && +f.edad > 0 && +f.edad < 120)) e.edad = 'vitrina.opinion.edad_invalida';
  if (f.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo)) e.correo = 'vitrina.opinion.correo_invalido';
  if (!f.acepto) e.acepto = 'vitrina.opinion.consentimiento_requerido';
  return e;
}

export function Opinion() {
  const d = useVitrina();
  const { t } = useTranslation();
  const enviar = useEnviarOpinion(d.params.etiqueta);
  const [f, setF] = useState(VACIO);
  const [intentado, setIntentado] = useState(false);
  const errores = intentado ? validarOpinion(f) : {};
  const poner = <K extends keyof typeof VACIO>(k: K, v: (typeof VACIO)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    setIntentado(true);
    if (Object.keys(validarOpinion(f)).length) return;
    const respuestas: Record<string, string> = {};
    if (f.sabor) respuestas.rateTaste = f.sabor;
    if (f.edad) respuestas.age = f.edad;
    if (f.genero) respuestas.gender = f.genero;
    const cuerpo: ApiProductLabelFeedback = {
      type: f.tipo,
      feedback: f.comentario.trim(),
      email: f.correo.trim() || undefined,
      gdprConsent: f.acepto,
      questionnaireAnswers: respuestas,
      productName: d.producto,
    };
    try {
      await enviar.mutateAsync(cuerpo);
      setF(VACIO);
      setIntentado(false);
    } catch {
      /* se muestra con enviar.isError */
    }
  }

  if (enviar.isSuccess) {
    return (
      <Seccion titulo={t('vitrina.opinion.titulo')}>
        <div className="grid justify-items-center gap-4 rounded-caja border border-linea bg-superficie p-10 text-center shadow-suave">
          <span className="grid size-14 place-items-center rounded-full bg-ok-suave text-ok">
            <Icono nombre="ok" className="size-7" />
          </span>
          <h2 className="font-titulo text-2xl font-semibold">{t('vitrina.opinion.gracias_titulo')}</h2>
          <p className="text-tinta-2">{t('vitrina.opinion.gracias')}</p>
          <Boton variante="secundario" onClick={() => enviar.reset()}>
            {t('vitrina.opinion.otro')}
          </Boton>
        </div>
      </Seccion>
    );
  }

  return (
    <Seccion titulo={t('vitrina.opinion.titulo')} intro={t('vitrina.opinion.intro', { producto: d.producto })}>
      <form onSubmit={alEnviar} noValidate className="grid gap-7">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold text-tinta-2">{t('vitrina.opinion.tipo')}</legend>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map((x) => (
              <Opcion key={x} nombre="tipo" activo={f.tipo === x} onElegir={() => poner('tipo', x)}>
                {t(`vitrina.opinion.tipos.${x}`)}
              </Opcion>
            ))}
          </div>
        </fieldset>

        <Area
          etiqueta={t('vitrina.opinion.comentario')}
          value={f.comentario}
          onChange={(e) => poner('comentario', e.target.value)}
          ayuda={`${f.comentario.length}/${MAX} · ${t('vitrina.opinion.comentario_ayuda')}`}
          error={errores.comentario && t(errores.comentario)}
        />

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold text-tinta-2">{t('vitrina.opinion.sabor', { producto: d.producto })}</legend>
          <div className="flex flex-wrap gap-2">
            {SABORES.map((x) => (
              <Opcion key={x} nombre="sabor" activo={f.sabor === x} onElegir={() => poner('sabor', f.sabor === x ? '' : x)}>
                {t(`vitrina.opinion.sabores.${x}`)}
              </Opcion>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-2">
          <Campo etiqueta={t('vitrina.opinion.edad')} inputMode="numeric" maxLength={3} value={f.edad} onChange={(e) => poner('edad', e.target.value.replace(/\D/g, ''))} error={errores.edad && t(errores.edad)} />
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-semibold text-tinta-2">{t('vitrina.opinion.genero')}</legend>
            <div className="flex flex-wrap gap-2">
              {GENEROS.map((x) => (
                <Opcion key={x} nombre="genero" activo={f.genero === x} onElegir={() => poner('genero', f.genero === x ? '' : x)}>
                  {t(`vitrina.opinion.generos.${x}`)}
                </Opcion>
              ))}
            </div>
          </fieldset>
        </div>

        <Campo etiqueta={t('vitrina.opinion.correo')} type="email" autoComplete="email" value={f.correo} onChange={(e) => poner('correo', e.target.value)} error={errores.correo && t(errores.correo)} />

        <div className="grid gap-2">
          <HtmlSeguro html={d.campo('settings.gdprText')} className="text-sm" />
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" checked={f.acepto} onChange={(e) => poner('acepto', e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--marca)]" aria-invalid={!!errores.acepto} />
            <span>{t('vitrina.opinion.consentimiento')}</span>
          </label>
          {errores.acepto && <p className="text-sm text-mal" role="alert">{t(errores.acepto)}</p>}
        </div>

        {enviar.isError && <Aviso tono="mal">{t('vitrina.opinion.error')}</Aviso>}
        {d.etiqueta.vistaPrevia && <Aviso tono="info">{t('vitrina.previa.sin_opinion')}</Aviso>}
        <div>
          <Boton type="submit" disabled={enviar.isPending || !!d.etiqueta.vistaPrevia}>
            {enviar.isPending ? t('vitrina.opinion.enviando') : t('vitrina.opinion.enviar')}
          </Boton>
        </div>
      </form>
    </Seccion>
  );
}

/** Opción de una sola elección con forma de píldora; activa = relleno de color. */
function Opcion({ nombre, activo, onElegir, children }: { nombre: string; activo: boolean; onElegir: () => void; children: React.ReactNode }) {
  return (
    <label className={'inline-flex h-10 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--foco)] ' + (activo ? 'border-marca bg-marca text-sobre-marca' : 'border-linea-fuerte bg-superficie text-tinta-2 hover:border-marca')}>
      <input type="radio" name={nombre} checked={activo} onChange={onElegir} onClick={activo ? onElegir : undefined} className="sr-only" />
      {children}
    </label>
  );
}
