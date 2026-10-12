package com.rescueride.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "rescue_requests", schema = "public")
public class RescueRequestEntity {
    @Id
    private UUID id;

    @Column(name = "driver_id")
    private UUID driverId;

    @Column(name = "mechanic_id")
    private UUID mechanicId;

    @Column(name = "status", insertable = false, updatable = false)
    private String status;

    @Column(name = "service_type")
    private String serviceType;

    @Column(name = "problem_description")
    private String problemDescription;

    @Column(name = "incident_address")
    private String incidentAddress;

    @Column(name = "incident_lat")
    private Double incidentLat;

    @Column(name = "incident_lng")
    private Double incidentLng;

    @Column(name = "vehicle_make")
    private String vehicleMake;

    @Column(name = "vehicle_model")
    private String vehicleModel;

    @Column(name = "vehicle_year")
    private Integer vehicleYear;

    @Column(name = "vehicle_color")
    private String vehicleColor;

    @Column(name = "vehicle_plate")
    private String vehiclePlate;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected RescueRequestEntity() {}

    public UUID getId() { return id; }
    public UUID getDriverId() { return driverId; }
    public UUID getMechanicId() { return mechanicId; }
    public String getStatus() { return status; }
    public String getServiceType() { return serviceType; }
    public String getProblemDescription() { return problemDescription; }
    public String getIncidentAddress() { return incidentAddress; }
    public Double getIncidentLat() { return incidentLat; }
    public Double getIncidentLng() { return incidentLng; }
    public String getVehicleMake() { return vehicleMake; }
    public String getVehicleModel() { return vehicleModel; }
    public Integer getVehicleYear() { return vehicleYear; }
    public String getVehicleColor() { return vehicleColor; }
    public String getVehiclePlate() { return vehiclePlate; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
