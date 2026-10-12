package com.rescueride.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.rescueride.dto.VehicleRequest;
import com.rescueride.exception.ApiException;
import com.rescueride.repository.DriverVehicleRepository;
import com.rescueride.security.AppPrincipal;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class VehicleServiceTest {
    @Mock private DriverVehicleRepository vehicles;

    private VehicleService service;
    private AppPrincipal driver;

    @BeforeEach
    void setUp() {
        service = new VehicleService(vehicles, new AccessControlService());
        driver = new AppPrincipal(UUID.randomUUID(), "driver@example.test", "driver", false, true);
    }

    @Test
    void refusesToExposeVehicleOwnedByAnotherDriver() {
        UUID vehicleId = UUID.randomUUID();
        when(vehicles.findByIdAndDriverIdAndArchivedFalse(vehicleId, driver.id())).thenReturn(Optional.empty());

        ApiException error = assertThrows(ApiException.class, () -> service.get(driver, vehicleId));

        assertEquals(404, error.getStatus().value());
    }

    @Test
    void rejectsDuplicatePlateBeforeSaving() {
        VehicleRequest request = new VehicleRequest("Toyota", "Corolla", 2022, "Blue", "ab 123 cd", null, null, null);
        when(vehicles.existsByDriverIdAndPlateIgnoreCaseAndArchivedFalse(driver.id(), "AB123CD")).thenReturn(true);

        ApiException error = assertThrows(ApiException.class, () -> service.create(driver, request));

        assertEquals(409, error.getStatus().value());
        verify(vehicles, never()).save(any());
    }

    @Test
    void rejectsVehicleOperationsForNonDrivers() {
        AppPrincipal mechanic = new AppPrincipal(UUID.randomUUID(), "mechanic@example.test", "mechanic", false, true);

        ApiException error = assertThrows(ApiException.class, () -> service.list(mechanic));

        assertEquals(403, error.getStatus().value());
        verify(vehicles, never()).findByDriverIdAndArchivedFalseOrderByUpdatedAtDesc(any());
    }
}
