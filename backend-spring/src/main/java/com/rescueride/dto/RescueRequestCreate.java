package com.rescueride.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RescueRequestCreate(
        @NotBlank @Size(max = 60) String serviceType,
        @NotBlank @Size(min = 8, max = 2000) String problemDescription,
        @Size(max = 300) String incidentAddress,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double incidentLat,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double incidentLng,
        @Size(max = 80) String vehicleMake,
        @Size(max = 80) String vehicleModel,
        @Min(1900) @Max(2100) Integer vehicleYear,
        @Size(max = 50) String vehicleColor,
        @Size(max = 30) String vehiclePlate,
        @JsonAlias({"target_mechanic_id", "preferredMechanicId", "preferred_mechanic_id"}) String targetMechanicId,
        @JsonAlias("vehicle_image_url") @Size(max = 1000) String vehicleImageUrl) {}
