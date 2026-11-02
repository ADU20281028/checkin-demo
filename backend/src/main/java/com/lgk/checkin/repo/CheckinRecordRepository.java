package com.lgk.checkin.repo;

import com.lgk.checkin.domain.CheckinRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface CheckinRecordRepository extends JpaRepository<CheckinRecord, Long> {

    Optional<CheckinRecord> findByTaskIdAndUserId(Long taskId, Long userId);

    boolean existsByTaskIdAndUserId(Long taskId, Long userId);

    long countByTaskId(Long taskId);

    List<CheckinRecord> findByTaskIdOrderByCheckinTimeAsc(Long taskId);

    Page<CheckinRecord> findByUserIdOrderByCheckinTimeDesc(Long userId, Pageable pageable);

    List<CheckinRecord> findByUserIdOrderByCheckinTimeDesc(Long userId);

    long countByCheckinTimeBetween(LocalDateTime start, LocalDateTime end);

    @Query("select r.task.id, count(r) from CheckinRecord r group by r.task.id")
    List<Object[]> countGroupByTask();
}
