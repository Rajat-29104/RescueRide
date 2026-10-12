package com.rescueride.controller;

import com.rescueride.dto.RescueRequestCreate;
import com.rescueride.security.AppPrincipal;
import com.rescueride.service.RescueRequestService;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class RescueRequestController {
    private final RescueRequestService service;

    public RescueRequestController(RescueRequestService service) { this.service = service; }

    @GetMapping("/requests")
    public Map<String, Object> list(@AuthenticationPrincipal AppPrincipal user,
            @RequestParam(required = false) UUID id) {
        return service.list(user, id);
    }

    @GetMapping("/requests/{id}")
    public Map<String, Object> detail(@AuthenticationPrincipal AppPrincipal user, @PathVariable UUID id) {
        return service.detail(user, id);
    }

    @PostMapping("/requests")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@AuthenticationPrincipal AppPrincipal user,
            @Valid @RequestBody RescueRequestCreate body) {
        return service.create(user, body);
    }

    @PatchMapping("/requests/status")
    public Map<String, Object> status(@AuthenticationPrincipal AppPrincipal user, @RequestBody Map<String, Object> body) {
        return service.updateStatus(user, body);
    }

    @PatchMapping("/requests/{id}/status")
    public Map<String, Object> statusById(@AuthenticationPrincipal AppPrincipal user,
            @PathVariable UUID id, @RequestBody Map<String, Object> body) {
        body.put("requestId", id.toString());
        return service.updateStatus(user, body);
    }

    @PatchMapping("/requests/rate")
    public Map<String, Object> rate(@AuthenticationPrincipal AppPrincipal user, @RequestBody Map<String, Object> body) {
        return service.rate(user, body);
    }

    @PatchMapping("/requests/{id}/rate")
    public Map<String, Object> rateById(@AuthenticationPrincipal AppPrincipal user,
            @PathVariable UUID id, @RequestBody Map<String, Object> body) {
        body.put("requestId", id.toString());
        return service.rate(user, body);
    }

    @GetMapping("/mechanics/available")
    public Map<String, Object> availableMechanics(@AuthenticationPrincipal AppPrincipal user,
            @RequestParam(required = false) Double lat, @RequestParam(required = false) Double lng) {
        return service.nearbyMechanics(user, lat, lng);
    }

    @GetMapping("/requests/{id}/messages")
    public Map<String, Object> messages(@AuthenticationPrincipal AppPrincipal user, @PathVariable UUID id) {
        return service.messageThread(user, id);
    }

    @PostMapping("/requests/{id}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> sendMessage(@AuthenticationPrincipal AppPrincipal user, @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {
        Object message = body.get("message");
        return service.sendMessage(user, id, message instanceof String text ? text : null);
    }
}
