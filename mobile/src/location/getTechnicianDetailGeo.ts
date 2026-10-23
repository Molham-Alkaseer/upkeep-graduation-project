import { getCurrentCoords, type CurrentCoords } from './getCurrentCoords';

/**
 * Best-effort coords for technician request detail (distance_km).
 * Returns null on permission deny or any location failure — detail should still load.
 */
export async function getTechnicianDetailGeo(): Promise<CurrentCoords | null> {
  try {
    return await getCurrentCoords();
  } catch {
    return null;
  }
}
