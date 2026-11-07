/**
 * Temas de la plataforma: 6 claros y 6 oscuros. Cada uno redefine los tokens de superficie, texto,
 * líneas y marca; los colores de estado (ok, aviso, mal, info) y las series de los gráficos son los
 * del modo (claro u oscuro), para que cada estado tenga siempre el mismo color.
 * Contraste validado (WCAG): texto ≥ 7:1 y secundario ≥ 4,5:1 sobre todos los fondos, marca como
 * texto ≥ 4,5:1, texto sobre la marca ≥ 4,5:1 y estados ≥ 4,5:1 sobre las superficies.
 */
export const TOKENS = ['papel', 'superficie', 'superficie-2', 'tinta', 'tinta-2', 'tinta-3', 'linea', 'linea-fuerte', 'marca', 'marca-fuerte', 'marca-suave', 'sobre-marca', 'acento', 'acento-suave', 'foco'] as const;
export type Token = (typeof TOKENS)[number];
export type Modo = 'claro' | 'oscuro';
export type DefTema = { id: string; modo: Modo; colores: Record<Token, string> };

export const TEMAS: DefTema[] = [
  { id: 'claro', modo: 'claro', colores: { papel: '#f7f5f0', superficie: '#ffffff', 'superficie-2': '#f1eee7', tinta: '#1b201d', 'tinta-2': '#4a524d', 'tinta-3': '#78807b', linea: '#e4dfd5', 'linea-fuerte': '#cfc8bb', marca: '#1f5b45', 'marca-fuerte': '#174535', 'marca-suave': '#e5efe9', 'sobre-marca': '#ffffff', acento: '#8f5523', 'acento-suave': '#f6eadc', foco: '#2f7d5d' } },
  { id: 'oceano', modo: 'claro', colores: { papel: '#f3f6f9', superficie: '#ffffff', 'superficie-2': '#e8eef4', tinta: '#142029', 'tinta-2': '#44525e', 'tinta-3': '#6f7c88', linea: '#dbe3eb', 'linea-fuerte': '#c3cfda', marca: '#1d5a8a', 'marca-fuerte': '#154468', 'marca-suave': '#e2edf6', 'sobre-marca': '#ffffff', acento: '#a8522a', 'acento-suave': '#f8e9de', foco: '#2b72ab' } },
  { id: 'terracota', modo: 'claro', colores: { papel: '#faf5f1', superficie: '#fffdfb', 'superficie-2': '#f3e9e1', tinta: '#241a15', 'tinta-2': '#54463e', 'tinta-3': '#85766d', linea: '#eaddd3', 'linea-fuerte': '#d6c4b6', marca: '#9a3b1d', 'marca-fuerte': '#7a2d15', 'marca-suave': '#f7e6dd', 'sobre-marca': '#ffffff', acento: '#3f6b5a', 'acento-suave': '#e2efe9', foco: '#b8532f' } },
  { id: 'lavanda', modo: 'claro', colores: { papel: '#f6f4fa', superficie: '#ffffff', 'superficie-2': '#ece8f4', tinta: '#1d1a26', 'tinta-2': '#4b4658', 'tinta-3': '#787287', linea: '#e1dcea', 'linea-fuerte': '#cbc4d8', marca: '#5b3d91', 'marca-fuerte': '#462e72', 'marca-suave': '#ece6f7', 'sobre-marca': '#ffffff', acento: '#9a5a26', 'acento-suave': '#f6eadc', foco: '#6e4fae' } },
  { id: 'grafito', modo: 'claro', colores: { papel: '#f4f4f4', superficie: '#ffffff', 'superficie-2': '#ebebeb', tinta: '#18191a', 'tinta-2': '#46494c', 'tinta-3': '#74787c', linea: '#dfdfdf', 'linea-fuerte': '#c8c8c8', marca: '#2d3a46', 'marca-fuerte': '#1d2731', 'marca-suave': '#e6eaee', 'sobre-marca': '#ffffff', acento: '#984a25', 'acento-suave': '#f7e8df', foco: '#4a5d70' } },
  { id: 'latte', modo: 'claro', colores: { papel: '#f8f3ec', superficie: '#fffcf8', 'superficie-2': '#f0e6da', tinta: '#231a12', 'tinta-2': '#53463a', 'tinta-3': '#84766a', linea: '#e8dccd', 'linea-fuerte': '#d4c3ae', marca: '#6b4226', 'marca-fuerte': '#52321c', 'marca-suave': '#f1e6dc', 'sobre-marca': '#ffffff', acento: '#2f6b4f', 'acento-suave': '#e1efe7', foco: '#8a5a36' } },
  { id: 'oscuro', modo: 'oscuro', colores: { papel: '#121513', superficie: '#1a1e1b', 'superficie-2': '#222723', tinta: '#ecefe9', 'tinta-2': '#b9c0ba', 'tinta-3': '#8a928c', linea: '#2d332f', 'linea-fuerte': '#3d4540', marca: '#5fb08c', 'marca-fuerte': '#7cc6a4', 'marca-suave': '#1d3329', 'sobre-marca': '#0e1a14', acento: '#e0a465', 'acento-suave': '#3a2a1a', foco: '#7cc6a4' } },
  { id: 'medianoche', modo: 'oscuro', colores: { papel: '#0e131a', superficie: '#151c25', 'superficie-2': '#1c2530', tinta: '#e8eef4', 'tinta-2': '#b3c0cc', 'tinta-3': '#8494a3', linea: '#26313d', 'linea-fuerte': '#36434f', marca: '#6eaae6', 'marca-fuerte': '#93c1ee', 'marca-suave': '#182a3d', 'sobre-marca': '#0a1520', acento: '#e3a46b', 'acento-suave': '#3a2a1b', foco: '#93c1ee' } },
  { id: 'carbon', modo: 'oscuro', colores: { papel: '#0e0e0e', superficie: '#171717', 'superficie-2': '#202020', tinta: '#ededed', 'tinta-2': '#bdbdbd', 'tinta-3': '#8f8f8f', linea: '#2a2a2a', 'linea-fuerte': '#3a3a3a', marca: '#ffb549', 'marca-fuerte': '#ffc876', 'marca-suave': '#3a2a10', 'sobre-marca': '#111111', acento: '#7cc6a4', 'acento-suave': '#17302a', foco: '#ffc876' } },
  { id: 'ciruela', modo: 'oscuro', colores: { papel: '#14111a', superficie: '#1c1824', 'superficie-2': '#241f2e', tinta: '#eeeaf4', 'tinta-2': '#c0b8cf', 'tinta-3': '#918aa1', linea: '#2f2939', 'linea-fuerte': '#3f384b', marca: '#b69cf0', 'marca-fuerte': '#cdb9f6', 'marca-suave': '#2c2240', 'sobre-marca': '#170f26', acento: '#e7a86f', 'acento-suave': '#3a2a1b', foco: '#cdb9f6' } },
  { id: 'brasa', modo: 'oscuro', colores: { papel: '#16110f', superficie: '#1e1714', 'superficie-2': '#271e1a', tinta: '#f2ebe7', 'tinta-2': '#c9bab2', 'tinta-3': '#998a82', linea: '#322723', 'linea-fuerte': '#443630', marca: '#ee8f63', 'marca-fuerte': '#f4ab88', 'marca-suave': '#3d2219', 'sobre-marca': '#1d0e07', acento: '#8cc7b0', 'acento-suave': '#1a3029', foco: '#f4ab88' } },
  { id: 'cacao', modo: 'oscuro', colores: { papel: '#13100d', superficie: '#1b1713', 'superficie-2': '#241e19', tinta: '#f0e9e1', 'tinta-2': '#c7baab', 'tinta-3': '#988a7c', linea: '#30281f', 'linea-fuerte': '#413629', marca: '#d9a86c', 'marca-fuerte': '#e6c08f', 'marca-suave': '#3a2b19', 'sobre-marca': '#1a1006', acento: '#86c3a2', 'acento-suave': '#18302a', foco: '#e6c08f' } },
];

export const temaPorId = (id: string | null | undefined) => TEMAS.find((t) => t.id === id);
