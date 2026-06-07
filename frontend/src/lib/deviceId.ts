// Identifiant d'appareil stable, persistant dans localStorage. Envoyé au login
// pour que la rotation des refresh tokens côté serveur ne révoque que les tokens
// de CET appareil (multi-device : un login ailleurs ne déconnecte pas celui-ci).
const KEY = 'daaragest_device_id';

export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}
