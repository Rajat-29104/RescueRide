package com.rescueride.service;

import com.rescueride.dto.VehicleRequest;
import com.rescueride.entity.DriverVehicleEntity;
import com.rescueride.exception.ApiException;
import com.rescueride.repository.DriverVehicleRepository;
import com.rescueride.security.AppPrincipal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VehicleService {
    private final DriverVehicleRepository vehicles;
    private final AccessControlService access;

    public VehicleService(DriverVehicleRepository vehicles, AccessControlService access) {
        this.vehicles = vehicles;
        this.access = access;
    }

    public Map<String, Object> list(AppPrincipal user) {
        access.requireRole(user, "driver");
        return Map.of("vehicles", vehicles.findByDriverIdAndArchivedFalseOrderByUpdatedAtDesc(user.id())
                .stream().map(this::toMap).toList());
    }

    public Map<String, Object> get(AppPrincipal user, UUID id) {
        access.requireRole(user, "driver");
        return Map.of("vehicle", toMap(owned(user, id)));
    }

    @Transactional
    public Map<String, Object> create(AppPrincipal user, VehicleRequest request) {
        access.requireRole(user, "driver");
        String plate = normalizePlate(request.plate());
        if (vehicles.existsByDriverIdAndPlateIgnoreCaseAndArchivedFalse(user.id(), plate)) {
            throw ApiException.conflict("A vehicle with this plate number already exists for this driver.");
        }
        DriverVehicleEntity saved = vehicles.save(DriverVehicleEntity.create(
                user.id(), clean(request.make()), clean(request.model()), request.year(), clean(request.color()),
                plate, normalizeVin(request.vin()), request.registrationExpiry(), cleanNullable(request.notes())));
        return Map.of("vehicle", toMap(saved));
    }

    @Transactional
    public Map<String, Object> update(AppPrincipal user, UUID id, VehicleRequest request) {
        access.requireRole(user, "driver");
        DriverVehicleEntity vehicle = owned(user, id);
        String plate = normalizePlate(request.plate());
        if (vehicles.existsByDriverIdAndPlateIgnoreCaseAndIdNotAndArchivedFalse(user.id(), plate, id)) {
            throw ApiException.conflict("A vehicle with this plate number already exists for this driver.");
        }
        vehicle.replace(clean(request.make()), clean(request.model()), request.year(), clean(request.color()),
                plate, normalizeVin(request.vin()), request.registrationExpiry(), cleanNullable(request.notes()));
        return Map.of("vehicle", toMap(vehicles.save(vehicle)));
    }

    @Transactional
    public Map<String, Object> archive(AppPrincipal user, UUID id) {
        access.requireRole(user, "driver");
        DriverVehicleEntity vehicle = owned(user, id);
        vehicle.archive();
        return Map.of("vehicle", toMap(vehicles.save(vehicle)), "archived", true);
    }

    private DriverVehicleEntity owned(AppPrincipal user, UUID id) {
        return vehicles.findByIdAndDriverIdAndArchivedFalse(id, user.id())
                .orElseThrow(() -> ApiException.notFound("Vehicle not found."));
    }

    private String normalizePlate(String plate) {
        return clean(plate).replaceAll("\\s+", "").toUpperCase();
    }

    private String normalizeVin(String vin) {
        String normalized = cleanNullable(vin);
        if (normalized == null) return null;
        normalized = normalized.toUpperCase();
        if (!normalized.matches("[A-HJ-NPR-Z0-9]{8,17}")) {
            throw ApiException.badRequest("VIN must be 8 to 17 characters using alphanumeric characters excluding I, O, and Q.");
        }
        return normalized;
    }

    private String clean(String value) { return value == null ? "" : value.trim(); }
    private String cleanNullable(String value) {
        String normalized = clean(value);
        return normalized.isEmpty() ? null : normalized;
    }

    private Map<String, Object> toMap(DriverVehicleEntity vehicle) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", vehicle.getId());
        map.put("driver_id", vehicle.getDriverId());
        map.put("make", vehicle.getMake());
        map.put("model", vehicle.getModel());
        map.put("year", vehicle.getYear());
        map.put("color", vehicle.getColor());
        map.put("plate", vehicle.getPlate());
        map.put("vin", vehicle.getVin());
        map.put("registration_expiry", vehicle.getRegistrationExpiry());
        map.put("notes", vehicle.getNotes());
        map.put("is_archived", vehicle.isArchived());
        map.put("created_at", vehicle.getCreatedAt());
        map.put("updated_at", vehicle.getUpdatedAt());
        return map;
    }
}
