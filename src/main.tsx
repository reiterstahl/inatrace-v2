import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './estilos/app.css';
import './i18n';
import { queryClient, router } from './rutas';
import { alTerminarSesion } from './api/sesion';
import { aplicarTema } from './util/tema';
import { Confirmaciones } from './componentes/ui/Confirmar';

aplicarTema();

// Si la sesión vence y no se puede renovar, se vuelve a la pantalla de ingreso.
alTerminarSesion(() => {
  queryClient.clear();
  void router.navigate({ to: '/ingreso', search: { volver: router.state.location.href, vencida: true } });
});

async function arrancar() {
  // Modo simulado: MSW responde la API con datos de ejemplo (sin backend).
  if (import.meta.env.MODE === 'simulado') {
    const { iniciarSimulacion } = await import('./mocks/navegador');
    await iniciarSimulacion();
  }
  createRoot(document.getElementById('raiz')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Confirmaciones />
      </QueryClientProvider>
    </StrictMode>,
  );
}
void arrancar();
