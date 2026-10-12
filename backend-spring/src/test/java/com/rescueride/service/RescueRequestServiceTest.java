package com.rescueride.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.rescueride.exception.ApiException;
import com.rescueride.security.AppPrincipal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class RescueRequestServiceTest {
    @Mock private JdbcTemplate jdbc;

    @Test
    void rejectsInvalidMechanicStatusTransitionBeforeWriting() {
        UUID requestId = UUID.randomUUID();
        UUID mechanicId = UUID.randomUUID();
        Map<String, Object> request = new HashMap<>();
        request.put("id", requestId);
        request.put("driver_id", UUID.randomUUID());
        request.put("mechanic_id", mechanicId);
        request.put("status", "pending");
        when(jdbc.queryForList(anyString(), eq(requestId))).thenReturn(List.of(request));

        RescueRequestService service = new RescueRequestService(jdbc, new AccessControlService());
        AppPrincipal mechanic = new AppPrincipal(mechanicId, "mechanic@example.test", "mechanic", false, true);
        ApiException error = assertThrows(ApiException.class, () -> service.updateStatus(
                mechanic, Map.of("requestId", requestId.toString(), "newStatus", "completed")));

        assertEquals(409, error.getStatus().value());
        verify(jdbc, never()).update(anyString(), org.mockito.ArgumentMatchers.<Object>any());
    }
}
