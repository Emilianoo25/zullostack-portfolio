/**
 * Panel de Dulce Ruby — conexión con Supabase (cuenta de Dulce Ruby).
 *
 * Vacío  → el panel funciona en MODO PRUEBA (datos sólo en el navegador).
 * Con datos → MODO NUBE: los datos quedan guardados en Supabase y se ven desde cualquier dispositivo.
 *
 * Dónde sacar estos valores: Supabase → Project Settings → API
 *   - Project URL                 → supabaseUrl
 *   - Publishable key (sb_publishable_…) o "anon public" → supabaseKey
 * Las dos son públicas por diseño (la seguridad la dan las políticas RLS del SQL).
 * NUNCA pongas acá la "secret" / "service_role" key.
 *
 * También se pueden cargar como variables de entorno en Vercel:
 *   PUBLIC_DR_SUPABASE_URL y PUBLIC_DR_SUPABASE_KEY (tienen prioridad sobre este archivo).
 */
export const panelConfig = {
  supabaseUrl: '',
  supabaseKey: '',
};
