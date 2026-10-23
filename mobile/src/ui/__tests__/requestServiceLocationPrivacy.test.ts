import {

  hasMapCoordinates,

  serviceLocationShowsMapPreview,

  technicianHasFullServiceLocation,

  technicianServiceLocationRedacted,

  type ServiceLocationRequest,

} from '../RequestServiceLocationSection';



const base: ServiceLocationRequest = {

  city: 'الرياض',

  district: 'العليا',

  address: 'شارع سري',

  latitude: 24.7,

  longitude: 46.6,

  status: 'pending',

  technician_id: null,

};



describe('request service location privacy', () => {

  it('redacts open pending for non-assigned technician', () => {

    expect(technicianServiceLocationRedacted(base, 10)).toBe(true);

    expect(technicianHasFullServiceLocation(base, 10)).toBe(false);

  });



  it('shows full location when assigned to me', () => {

    const assigned: ServiceLocationRequest = {

      ...base,

      status: 'in_progress',

      technician_id: 10,

    };

    expect(technicianServiceLocationRedacted(assigned, 10)).toBe(false);

    expect(technicianHasFullServiceLocation(assigned, 10)).toBe(true);

  });



  describe('hasMapCoordinates', () => {

    it('is true when finite lat/lng present', () => {

      expect(hasMapCoordinates(base)).toBe(true);

    });



    it('is false when coords missing or invalid', () => {

      expect(hasMapCoordinates({ ...base, latitude: null, longitude: null })).toBe(false);

      expect(hasMapCoordinates({ ...base, latitude: Number.NaN, longitude: 46.6 })).toBe(false);

    });

  });



  describe('serviceLocationShowsMapPreview', () => {

    it('hides map for redacted open-market technician even with coords', () => {

      expect(technicianServiceLocationRedacted(base, 10)).toBe(true);

      expect(hasMapCoordinates(base)).toBe(true);

      expect(serviceLocationShowsMapPreview(base, 'technician', 10)).toBe(false);

    });



    it('shows map for customer when coords exist', () => {

      expect(serviceLocationShowsMapPreview(base, 'customer', undefined)).toBe(true);

    });



    it('shows map for assigned technician when coords exist', () => {

      const assigned: ServiceLocationRequest = {

        ...base,

        status: 'in_progress',

        technician_id: 10,

      };

      expect(serviceLocationShowsMapPreview(assigned, 'technician', 10)).toBe(true);

    });



    it('hides map when coords absent', () => {

      const noCoords: ServiceLocationRequest = {

        ...base,

        latitude: null,

        longitude: null,

      };

      expect(serviceLocationShowsMapPreview(noCoords, 'customer', undefined)).toBe(false);

      expect(serviceLocationShowsMapPreview(noCoords, 'technician', 10)).toBe(false);

    });

  });

});


