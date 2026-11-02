-- Monedas para una copia AISLADA de prueba (nunca en una instalación real).
-- El backend las carga al arrancar desde exchangeratesapi.io con INAtrace.exchangerate.apiKey; sin esa
-- llave la tabla queda vacía y ninguna empresa puede elegir su moneda base (la ficha la exige).
-- Idempotente. Uso:
--   docker exec -i v2demo-db-1 sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" $MYSQL_DATABASE' < scripts/sembrar-monedas.sql
INSERT INTO CurrencyType (code, label, enabled)
SELECT v.code, v.label, TRUE
FROM (
  SELECT 'EUR' AS code, 'Euro' AS label UNION ALL
  SELECT 'USD', 'United States Dollar' UNION ALL
  SELECT 'CRC', 'Costa Rican Colón' UNION ALL
  SELECT 'GTQ', 'Guatemalan Quetzal' UNION ALL
  SELECT 'HNL', 'Honduran Lempira' UNION ALL
  SELECT 'RWF', 'Rwandan Franc'
) v
WHERE NOT EXISTS (SELECT 1 FROM CurrencyType c WHERE c.code = v.code);
