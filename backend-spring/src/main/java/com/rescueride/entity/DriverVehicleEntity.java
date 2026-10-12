package com.rescueride.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "driver_vehicles", schema = "public")
public class DriverVehicleEntity {
    @Id
    @UuidGenerator
    private UUID id;

    @Column(name = "driver_id", nullable = false)
    private UUID driverId;

    @Column(nullable = false)
    private String make;

    @Column(nullable = false)
    private String model;

    @Column(nullable = false)
    private Integer year;

    @Column(nullable = false)
    private String color;

    @Column(nullable = false)
    private String plate;

    @Column(length = 17)
    private String vin;

    @Column(name = "registration_expiry")
    private LocalDate registrationExpiry;

    private String notes;

    @Column(name = "is_archived", nullable = false)
    private boolean archived;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected DriverVehicleEntity() {}

    public static DriverVehicleEntity create(
            UUID driverId, String make, String model, Integer year, String color, String plate,
            String vin, LocalDate registrationExpiry, String notes) {
        DriverVehicleEntity entity = new DriverVehicleEntity();
        entity.driverId = driverId;
        entity.make = make;
        entity.model = model;
        entity.year = year;
        entity.color = color;
        entity.plate = plate;
        entity.vin = vin;
        entity.registrationExpiry = registrationExpiry;
        entity.notes = notes;
        return entity;
    }

    public void replace(String make, String model, Integer year, String color, String plate,
            String vin, LocalDate registrationExpiry, String notes) {
        this.make = make;
        this.model = model;
        this.year = year;
        this.color = color;
        this.plate = plate;
        this.vin = vin;
        this.registrationExpiry = registrationExpiry;
        this.notes = notes;
    }

    public void archive() { this.archived = true; }
    public UUID getId() { return id; }
    public UUID getDriverId() { return driverId; }
    public String getMake() { return make; }
    public String getModel() { return model; }
    public Integer getYear() { return year; }
    public String getColor() { return color; }
    public String getPlate() { return plate; }
    public String getVin() { return vin; }
    public LocalDate getRegistrationExpiry() { return registrationExpiry; }
    public String getNotes() { return notes; }
    public boolean isArchived() { return archived; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
