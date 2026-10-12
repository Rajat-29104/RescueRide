package com.rescueride.controller;

import com.rescueride.dto.VehicleRequest;
import com.rescueride.security.AppPrincipal;
import com.rescueride.service.VehicleService;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/vehicles")
public class VehicleController {
    private final VehicleService service;

    public VehicleController(VehicleService service) { this.service = service; }

    @GetMapping
    public Map<String, Object> list(@AuthenticationPrincipal AppPrincipal user) { return service.list(user); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@AuthenticationPrincipal AppPrincipal user, @Valid @RequestBody VehicleRequest body) {
        return service.create(user, body);
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(@AuthenticationPrincipal AppPrincipal user, @PathVariable UUID id) {
        return service.get(user, id);
    }

    @PatchMapping("/{id}")
    public Map<String, Object> update(
            @AuthenticationPrincipal AppPrincipal user, @PathVariable UUID id, @Valid @RequestBody VehicleRequest body) {
        return service.update(user, id, body);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> archive(@AuthenticationPrincipal AppPrincipal user, @PathVariable UUID id) {
        return service.archive(user, id);
    }
}
