package com.rescueride.repository;

import com.rescueride.entity.RescueRequestEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RescueRequestRepository extends JpaRepository<RescueRequestEntity, UUID> {
    List<RescueRequestEntity> findTop50ByDriverIdOrderByCreatedAtDesc(UUID driverId);
    List<RescueRequestEntity> findTop100ByMechanicIdOrderByCreatedAtDesc(UUID mechanicId);
}
