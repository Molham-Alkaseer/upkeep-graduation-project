import type { ServiceRequestRow } from '../../api';
import { technicianNearbyShowNoPinBadge } from '../technicianNearbyList';

const openPending: ServiceRequestRow = {
  request_id: 1,
  customer_id: 2,
  technician_id: null,
  service_type: 1,
  service: null,
  status: 'pending',
  payment_status: 'pending',
  description: 'test',
  city: 'Riyadh',
  district: 'Olaya',
  address: null,
  preferred_date: null,
  preferred_time: null,
  notes: null,
  created_at: null,
  completed_at: null,
  customer: null,
  technician: null,
};

describe('technicianNearbyShowNoPinBadge', () => {
  it('shows for open pending without distance when geo active', () => {
    expect(technicianNearbyShowNoPinBadge(openPending, true)).toBe(true);
  });

  it('hides when geo inactive', () => {
    expect(technicianNearbyShowNoPinBadge(openPending, false)).toBe(false);
  });

  it('hides when distance_km present', () => {
    expect(technicianNearbyShowNoPinBadge({ ...openPending, distance_km: 3.2 }, true)).toBe(false);
  });

  it('hides for assigned jobs', () => {
    expect(
      technicianNearbyShowNoPinBadge(
        { ...openPending, technician_id: 10, status: 'assigned' },
        true,
      ),
    ).toBe(false);
  });
});
