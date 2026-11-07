import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { COLORES_AVATAR, SEMILLAS, avatarAlAzar, useAvatar, type ColorAvatar } from '@/util/avatar';
import { Avatar } from './Avatar';
import { Icono } from './Icono';

/** Elegir la imagen de perfil: semilla y color, o una al azar. */
export function SelectorAvatar({ cuenta }: { cuenta: string }) {
  const { t } = useTranslation();
  const [avatar, elegir] = useAvatar(cuenta);
  const casilla = 'grid place-items-center rounded-full border-2 transition';
  return (
    <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-8">
      <div className="flex items-center gap-4 sm:flex-col">
        <Avatar avatar={avatar} className="size-20" />
        <button type="button" onClick={() => elegir(avatarAlAzar(avatar))} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-linea px-3 text-sm font-semibold text-tinta hover:bg-superficie-2">
          <Icono nombre="hoja" className="size-4" />
          {t('perfil.avatar.azar')}
        </button>
      </div>
      <div className="grid gap-4">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold text-tinta-2">{t('perfil.avatar.semilla')}</legend>
          <div className="flex flex-wrap gap-2">
            {SEMILLAS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={avatar.semilla === s}
                aria-label={t(`perfil.avatar.semillas.${s}`)}
                title={t(`perfil.avatar.semillas.${s}`)}
                onClick={() => elegir({ ...avatar, semilla: s })}
                className={clsx(casilla, 'p-0.5', avatar.semilla === s ? 'border-marca' : 'border-transparent hover:border-linea-fuerte')}
              >
                <Avatar avatar={{ semilla: s, color: avatar.color }} className="size-11" />
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold text-tinta-2">{t('perfil.avatar.color')}</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(COLORES_AVATAR) as ColorAvatar[]).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={avatar.color === c}
                aria-label={t(`perfil.avatar.colores.${c}`)}
                title={t(`perfil.avatar.colores.${c}`)}
                onClick={() => elegir({ ...avatar, color: c })}
                className={clsx(casilla, 'size-9 p-0.5', avatar.color === c ? 'border-marca' : 'border-transparent hover:border-linea-fuerte')}
              >
                <span className="size-full rounded-full" style={{ background: COLORES_AVATAR[c] }} />
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
