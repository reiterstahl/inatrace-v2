import { describe, expect, it } from 'vitest';
import { armarCliente, formDesdeCliente, lugarCliente, validarCliente } from './cliente';

const cr = { id: 54, code: 'CR', name: 'Costa Rica' };
const rw = { id: 184, code: 'RW', name: 'Rwanda' };
const cliente = { id: 3, companyId: 1, name: 'Tostaduría', vatId: '3-101', email: 'compras@tostaduria.example', location: { city: 'San José', zip: '10101', country: cr, latitude: 9.9 } };

describe('clientes', () => {
  it('ida y vuelta: conserva lo que no edita', () => {
    const a = armarCliente(cliente, formDesdeCliente(cliente), 1, [cr]);
    expect(a).toMatchObject({ id: 3, companyId: 1, name: 'Tostaduría', vatId: '3-101', email: 'compras@tostaduria.example' });
    expect(a.location).toMatchObject({ city: 'San José', zip: '10101', country: cr, latitude: 9.9 });
  });

  it('solo manda la dirección del formato del país', () => {
    const f = { ...formDesdeCliente(cliente), pais: 184, codigoPais: 'RW', dir: { ...formDesdeCliente(cliente).dir, village: 'Nyamata', cell: 'Kanazi' } };
    const a = armarCliente(cliente, f, 1, [cr, rw]);
    expect(a.location).toMatchObject({ country: rw, village: 'Nyamata', cell: 'Kanazi' });
    expect(a.location).not.toHaveProperty('city');
    expect(lugarCliente(a)).toBe('Kanazi, Rwanda');
  });

  it('valida nombre, país, correo y código postal', () => {
    expect(validarCliente(formDesdeCliente(cliente))).toEqual({});
    expect(validarCliente(formDesdeCliente(null))).toEqual({ nombre: 'requerido', pais: 'requerido' });
    const f = formDesdeCliente(cliente);
    expect(validarCliente({ ...f, correo: 'sin-arroba', dir: { ...f.dir, zip: '9'.repeat(51) } })).toEqual({ correo: 'correo', zip: 'largo_50' });
  });
});
