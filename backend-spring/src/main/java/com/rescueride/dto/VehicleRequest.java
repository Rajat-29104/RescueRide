package com.rescueride.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record VehicleRequest(
        @NotBlank @Size(max = 80) String make,
        @NotBlank @Size(max = 80) String model,
        @NotNull @Min(1900) @Max(2100) Integer year,
        @NotBlank @Size(max = 50) String color,
        @NotBlank @Size(max = 30) String plate,
        @Size(max = 17) String vin,
        @JsonAlias("registration_expiry") LocalDate registrationExpiry,
        @Size(max = 500) String notes) {}
