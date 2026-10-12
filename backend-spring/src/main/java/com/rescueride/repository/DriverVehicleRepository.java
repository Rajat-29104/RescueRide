package com.rescueride.repository;

import com.rescueride.entity.DriverVehicleEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DriverVehicleRepository extends JpaRepository<DriverVehicleEntity, UUID> {
    List<DriverVehicleEntity> findByDriverIdAndArchivedFalseOrderByUpdatedAtDesc(UUID driverId);
    Optional<DriverVehicleEntity> findByIdAndDriverIdAndArchivedFalse(UUID id, UUID driverId);
    boolean existsByDriverIdAndPlateIgnoreCaseAndArchivedFalse(UUID driverId, String plate);
    boolean existsByDriverIdAndPlateIgnoreCaseAndIdNotAndArchivedFalse(UUID driverId, String plate, UUID id);
}
